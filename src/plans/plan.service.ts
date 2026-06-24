import { FieldValue } from "firebase-admin/firestore";
import { getFirestoreDb } from "../firebase/firestore.js";
import type { CurrentUser } from "../auth/current-user.js";
import type { CreatePlanInput, PlanRecord, PlanVisibility, PublicPlanRecord, UpdatePlanInput } from "./plan.types.js";

const PLANS_COLLECTION = "plans";
const PUBLIC_PLAN_LIMIT = 24;

export class PlanForbiddenError extends Error {
  constructor() {
    super("Plan access denied.");
  }
}

function timestampToIso(value: any): string | null {
  return typeof value?.toDate === "function" ? value.toDate().toISOString() : null;
}

function parseVisibility(value: unknown): PlanVisibility {
  return value === "public" ? "public" : "private";
}

function getUserDisplayName(user: CurrentUser): string {
  return user.displayName || user.email.split("@")[0] || user.email;
}

function toPlanRecord(id: string, data: FirebaseFirestore.DocumentData): PlanRecord {
  return {
    id,
    ownerEmail: String(data.ownerEmail || ""),
    ownerDisplayName: String(data.ownerDisplayName || ""),
    name: String(data.name || ""),
    mode: String(data.mode || ""),
    description: String(data.description || ""),
    visibility: parseVisibility(data.visibility),
    config: data.config ?? {},
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
    sharedAt: timestampToIso(data.sharedAt),
  };
}

function toPublicPlanRecord(plan: PlanRecord): PublicPlanRecord {
  return {
    id: plan.id,
    ownerDisplayName: plan.ownerDisplayName,
    name: plan.name,
    mode: plan.mode,
    description: plan.description,
    visibility: plan.visibility,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
    sharedAt: plan.sharedAt,
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

export async function listPublicPlans(): Promise<PublicPlanRecord[]> {
  const snapshot = await getFirestoreDb()
    .collection(PLANS_COLLECTION)
    .where("visibility", "==", "public")
    .get();

  return snapshot.docs
    .map((doc) => toPlanRecord(doc.id, doc.data()))
    .sort((a, b) => String(b.sharedAt || b.updatedAt || "").localeCompare(String(a.sharedAt || a.updatedAt || "")))
    .slice(0, PUBLIC_PLAN_LIMIT)
    .map(toPublicPlanRecord);
}

export async function createPlan(user: CurrentUser, input: CreatePlanInput): Promise<PlanRecord> {
  const db = getFirestoreDb();
  const planRef = db.collection(PLANS_COLLECTION).doc();
  const visibility = parseVisibility(input.visibility);
  const planData: Record<string, unknown> = {
    ownerEmail: user.email,
    ownerDisplayName: getUserDisplayName(user),
    name: input.name,
    mode: input.mode,
    description: input.description || "",
    visibility,
    config: input.config ?? {},
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (visibility === "public") {
    planData.sharedAt = FieldValue.serverTimestamp();
  }

  await planRef.set(planData);

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
    ownerDisplayName: getUserDisplayName(user),
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

  if (input.description !== undefined) {
    patch.description = input.description;
  }

  if (input.visibility !== undefined) {
    patch.visibility = parseVisibility(input.visibility);

    if (input.visibility === "public") {
      patch.sharedAt = FieldValue.serverTimestamp();
    }
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
