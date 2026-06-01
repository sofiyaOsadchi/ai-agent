import type { Request, Response } from "express";
import { getOrCreateUser, normalizeUserEmail } from "../users/user.service.js";

export type UserRole = "admin" | "user";
export type UserStatus = "active" | "blocked";

export type CurrentUser = {
  email: string;
  role: UserRole;
  status: UserStatus;
};

function isProductionRuntime(): boolean {
  return Boolean(
    process.env.NODE_ENV === "production" ||
    process.env.K_SERVICE ||
    process.env.K_REVISION ||
    process.env.K_CONFIGURATION
  );
}

function extractEmailFromIapHeader(value?: string): string | null {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return null;
  }

  const email = rawValue.includes(":")
    ? rawValue.slice(rawValue.lastIndexOf(":") + 1)
    : rawValue;

  return normalizeUserEmail(email);
}

export function getCurrentUserEmailFromRequest(req: Request): string | null {
  const iapEmail = extractEmailFromIapHeader(req.get("x-goog-authenticated-user-email"));

  if (iapEmail) {
    return iapEmail;
  }

  if (!isProductionRuntime()) {
    return normalizeUserEmail(process.env.DEV_USER_EMAIL || "");
  }

  return null;
}

export async function getCurrentUser(req: Request): Promise<CurrentUser | null> {
  const email = getCurrentUserEmailFromRequest(req);

  if (!email) {
    return null;
  }

  return getOrCreateUser(email);
}

export async function requireActiveCurrentUser(req: Request, res: Response): Promise<CurrentUser | null> {
  const user = await getCurrentUser(req);

  if (!user) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }

  if (user.status === "blocked") {
    res.status(403).json({ error: "User is blocked" });
    return null;
  }

  return user;
}
