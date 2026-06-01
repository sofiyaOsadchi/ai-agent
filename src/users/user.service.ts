import { FieldValue } from "firebase-admin/firestore";
import { getFirestoreDb } from "../firebase/firestore.js";
import type { CurrentUser, UserRole, UserStatus } from "../auth/current-user.js";

const USERS_COLLECTION = "users";

export function normalizeUserEmail(value: string): string | null {
  const email = String(value || "").trim().toLowerCase();

  if (!email || email.includes("/") || !email.includes("@")) {
    return null;
  }

  return email;
}

function parseRole(value: unknown): UserRole {
  return value === "admin" ? "admin" : "user";
}

function parseStatus(value: unknown): UserStatus {
  return value === "blocked" ? "blocked" : "active";
}

function getFirstAdminEmail(): string | null {
  return normalizeUserEmail(process.env.FIRST_ADMIN_EMAIL || "");
}

export async function getOrCreateUser(rawEmail: string): Promise<CurrentUser> {
  const email = normalizeUserEmail(rawEmail);

  if (!email) {
    throw new Error("Invalid user email.");
  }

  const db = getFirestoreDb();
  const userRef = db.collection(USERS_COLLECTION).doc(email);
  let resolvedUser: CurrentUser | null = null;

  await db.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);

    if (userSnapshot.exists) {
      const data = userSnapshot.data() || {};
      const user: CurrentUser = {
        email,
        role: parseRole(data.role),
        status: parseStatus(data.status),
      };

      resolvedUser = user;

      if (user.status === "active") {
        transaction.set(
          userRef,
          {
            email,
            role: user.role,
            status: user.status,
            updatedAt: FieldValue.serverTimestamp(),
            lastSeenAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      return;
    }

    const firstUserSnapshot = await transaction.get(db.collection(USERS_COLLECTION).limit(1));
    const role: UserRole = firstUserSnapshot.empty || email === getFirstAdminEmail()
      ? "admin"
      : "user";
    const user: CurrentUser = {
      email,
      role,
      status: "active",
    };

    transaction.set(userRef, {
      email,
      role,
      status: user.status,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastSeenAt: FieldValue.serverTimestamp(),
    });

    resolvedUser = user;
  });

  if (!resolvedUser) {
    throw new Error("Failed to resolve current user.");
  }

  return resolvedUser;
}
