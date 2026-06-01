import { FieldValue } from "firebase-admin/firestore";
import { getFirestoreDb } from "../firebase/firestore.js";
import type { CurrentUser } from "../auth/current-user.js";
import { normalizeUserEmail } from "../users/user.service.js";
import type { CreateRunInput, RunRecord, RunStatus, UpdateRunInput } from "./run.types.js";

const RUNS_COLLECTION = "runs";

export class RunForbiddenError extends Error {
  constructor() {
    super("Run access denied.");
  }
}

function timestampToIso(value: any): string | null {
  return typeof value?.toDate === "function" ? value.toDate().toISOString() : null;
}

function parseStatus(value: unknown): RunStatus {
  if (value === "completed" || value === "failed") {
    return value;
  }

  return "running";
}

function toRunRecord(id: string, data: FirebaseFirestore.DocumentData): RunRecord {
  const run: RunRecord = {
    id,
    userEmail: String(data.userEmail || ""),
    mode: String(data.mode || ""),
    status: parseStatus(data.status),
    startedAt: timestampToIso(data.startedAt),
    configSnapshot: data.configSnapshot ?? {},
  };

  if (typeof data.planId === "string" && data.planId) {
    run.planId = data.planId;
  }

  if (data.finishedAt !== undefined) {
    run.finishedAt = timestampToIso(data.finishedAt);
  }

  if (data.outputLinks !== undefined) {
    run.outputLinks = data.outputLinks;
  }

  if (typeof data.errorMessage === "string" && data.errorMessage) {
    run.errorMessage = data.errorMessage;
  }

  return run;
}

function canAccessRun(user: CurrentUser, run: RunRecord, includeAll: boolean): boolean {
  return run.userEmail === user.email || (user.role === "admin" && includeAll);
}

export async function listRuns(user: CurrentUser, includeAll: boolean): Promise<RunRecord[]> {
  const db = getFirestoreDb();
  const query = user.role === "admin" && includeAll
    ? db.collection(RUNS_COLLECTION)
    : db.collection(RUNS_COLLECTION).where("userEmail", "==", user.email);

  const snapshot = await query.get();
  return snapshot.docs.map((doc) => toRunRecord(doc.id, doc.data()));
}

export async function getRunById(
  user: CurrentUser,
  runId: string,
  includeAll: boolean
): Promise<RunRecord | null> {
  const db = getFirestoreDb();
  const snapshot = await db.collection(RUNS_COLLECTION).doc(runId).get();

  if (!snapshot.exists) {
    return null;
  }

  const run = toRunRecord(snapshot.id, snapshot.data() || {});

  if (!canAccessRun(user, run, includeAll)) {
    throw new RunForbiddenError();
  }

  return run;
}

export async function createRun(input: CreateRunInput): Promise<RunRecord> {
  const userEmail = normalizeUserEmail(input.userEmail);

  if (!userEmail) {
    throw new Error("Invalid run user email.");
  }

  const db = getFirestoreDb();
  const runRef = db.collection(RUNS_COLLECTION).doc();
  const runData: Record<string, unknown> = {
    userEmail,
    mode: input.mode,
    status: "running",
    startedAt: FieldValue.serverTimestamp(),
    configSnapshot: input.configSnapshot ?? {},
  };

  if (input.planId) {
    runData.planId = input.planId;
  }

  await runRef.set(runData);

  const snapshot = await runRef.get();
  return toRunRecord(snapshot.id, snapshot.data() || {});
}

export async function updateRun(runId: string, input: UpdateRunInput): Promise<RunRecord | null> {
  const db = getFirestoreDb();
  const runRef = db.collection(RUNS_COLLECTION).doc(runId);
  const snapshot = await runRef.get();

  if (!snapshot.exists) {
    return null;
  }

  const patch: Record<string, unknown> = {};

  if (input.status) {
    patch.status = input.status;
  }

  if (input.finishedAt) {
    patch.finishedAt = FieldValue.serverTimestamp();
  }

  if (input.outputLinks !== undefined) {
    patch.outputLinks = input.outputLinks;
  }

  if (input.errorMessage !== undefined) {
    patch.errorMessage = input.errorMessage;
  }

  if (Object.keys(patch).length) {
    await runRef.set(patch, { merge: true });
  }

  const updatedSnapshot = await runRef.get();
  return toRunRecord(updatedSnapshot.id, updatedSnapshot.data() || {});
}
