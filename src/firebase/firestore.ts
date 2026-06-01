import { applicationDefault, getApps, initializeApp, type App } from "firebase-admin/app";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";

let cachedFirestore: Firestore | undefined;

function getConfiguredFirestoreProjectId(): string | undefined {
  const projectId = process.env.FIRESTORE_PROJECT_ID?.trim();
  return projectId || undefined;
}

function getFirebaseAdminApp(): App {
  const existingApp = getApps()[0];

  if (existingApp) {
    return existingApp;
  }

  return initializeApp({
    credential: applicationDefault(),
    projectId: getConfiguredFirestoreProjectId(),
  });
}

export function getFirestoreDb(): Firestore {
  if (!cachedFirestore) {
    cachedFirestore = getFirestore(getFirebaseAdminApp());
  }

  return cachedFirestore;
}

export async function writeFirestoreHealthCheck(): Promise<void> {
  await getFirestoreDb()
    .collection("systemChecks")
    .doc("firestore-health")
    .set(
      {
        ok: true,
        checkedAt: FieldValue.serverTimestamp(),
        source: "server-demo",
      },
      { merge: true }
    );
}
