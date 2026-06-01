import { FieldValue } from "firebase-admin/firestore";
import { getFirestoreDb } from "../firebase/firestore.js";
import type { CurrentUser } from "../auth/current-user.js";
import type { CreatePlanInput, PlanRecord, UpdatePlanInput } from "./plan.types.js";

const PLANS_COLLECTION = "plans";

export class PlanForbiddenError extends Error {
  constructor() {
    super("Plan access denied.");
  }
}

function timestampToIso(value: any): string | null {
  return typeof value?.toDate === "function" ? value.toDate().toISOString() : null;
}

function toPlanRecord(id: string, data: FirebaseFirestore.DocumentData): PlanRecord {
  return {
    id,
    ownerEmail: String(data.ownerEmail || ""),
    name: String(data.name || ""),
    mode: String(data.mode || ""),
    config: data.config ?? {},
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
  };
}

function canAccessPlan(user: CurrentUser, plan: PlanRecord): boolean {
  return user.role === "admin" || plan.ownerEmail === user.email;
}

export async function listPlans(user: CurrentUser, includeAll: boolean): Promise<PlanRecord[]> {
  const db = getFirestoreDb();
  const query = user.role === "admin" && includeAll
    ? db.collection(PLANS_COLLECTION)
    : db.collection(PLANS_COLLECTION).where("ownerEmail", "==", user.email);

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => toPlanRecord(doc.id, doc.data()));
}

export async function createPlan(user: CurrentUser, input: CreatePlanInput): Promise<PlanRecord> {
  const db = getFirestoreDb();
  const planRef = db.collection(PLANS_COLLECTION).doc();

  await planRef.set({
    ownerEmail: user.email,
    name: input.name,
    mode: input.mode,
    config: input.config ?? {},
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  const snapshot = await planRef.get();
  return toPlanRecord(snapshot.id, snapshot.data() || {});
}

export async function updatePlan(
  user: CurrentUser,
  planId: string,
  input: UpdatePlanInput
): Promise<PlanRecord | null> {
  const db = getFirestoreDb();
  const planRef = db.collection(PLANS_COLLECTION).doc(planId);
  const snapshot = await planRef.get();

  if (!snapshot.exists) {
    return null;
  }

  const plan = toPlanRecord(snapshot.id, snapshot.data() || {});

  if (!canAccessPlan(user, plan)) {
    throw new PlanForbiddenError();
  }

  const patch: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (input.name !== undefined) {
    patch.name = input.name;
  }

  if (input.mode !== undefined) {
    patch.mode = input.mode;
  }

  if (input.config !== undefined) {
    patch.config = input.config;
  }

  await planRef.set(patch, { merge: true });

  const updatedSnapshot = await planRef.get();
  return toPlanRecord(updatedSnapshot.id, updatedSnapshot.data() || {});
}

export async function deletePlan(user: CurrentUser, planId: string): Promise<boolean> {
  const db = getFirestoreDb();
  const planRef = db.collection(PLANS_COLLECTION).doc(planId);
  const snapshot = await planRef.get();

  if (!snapshot.exists) {
    return false;
  }

  const plan = toPlanRecord(snapshot.id, snapshot.data() || {});

  if (!canAccessPlan(user, plan)) {
    throw new PlanForbiddenError();
  }

  await planRef.delete();
  return true;
}
