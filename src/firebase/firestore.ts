import { applicationDefault, getApps, initializeApp, type App } from "firebase-admin/app";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";

let cachedFirestore: Firestore | undefined;

type FirestoreWithProjectId = Firestore & {
  projectId?: unknown;
};

type CredentialWithProjectId = {
  getProjectId?: () => Promise<string>;
};

export type FirestoreDebugInfo = {
  FIRESTORE_PROJECT_ID: string | null;
  GOOGLE_CLOUD_PROJECT: string | null;
  GCLOUD_PROJECT: string | null;
  FIREBASE_CONFIG: {
    exists: boolean;
    projectId: string | null;
  };
  firebaseAdmin: {
    appOptionsProjectId: string | null;
    credentialProjectId: string | null;
    credentialProjectIdError?: string;
    firestoreProjectId: string | null;
    firestoreProjectIdError?: string;
  };
};

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

function getFirebaseConfigProjectId(): string | undefined {
  const rawConfig = process.env.FIREBASE_CONFIG?.trim();

  if (!rawConfig || !rawConfig.startsWith("{")) {
    return undefined;
  }

  try {
    const parsedConfig = JSON.parse(rawConfig) as { projectId?: unknown };
    return typeof parsedConfig.projectId === "string" ? parsedConfig.projectId : undefined;
  } catch {
    return undefined;
  }
}

export async function getFirestoreDebugInfo(): Promise<FirestoreDebugInfo> {
  const app = getFirebaseAdminApp();
  const debugInfo: FirestoreDebugInfo = {
    FIRESTORE_PROJECT_ID: getConfiguredFirestoreProjectId() || null,
    GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT || null,
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT || null,
    FIREBASE_CONFIG: {
      exists: Boolean(process.env.FIREBASE_CONFIG),
      projectId: getFirebaseConfigProjectId() || null,
    },
    firebaseAdmin: {
      appOptionsProjectId: app.options.projectId || null,
      credentialProjectId: null,
      firestoreProjectId: null,
    },
  };

  const credential = app.options.credential as CredentialWithProjectId | undefined;

  if (typeof credential?.getProjectId === "function") {
    try {
      debugInfo.firebaseAdmin = {
        ...debugInfo.firebaseAdmin,
        credentialProjectId: await credential.getProjectId(),
      };
    } catch (error: any) {
      debugInfo.firebaseAdmin = {
        ...debugInfo.firebaseAdmin,
        credentialProjectIdError: error?.message || "Could not resolve credential projectId.",
      };
    }
  }

  try {
    const firestoreProjectId = (getFirestoreDb() as FirestoreWithProjectId).projectId;
    debugInfo.firebaseAdmin = {
      ...debugInfo.firebaseAdmin,
      firestoreProjectId: typeof firestoreProjectId === "string" ? firestoreProjectId : null,
    };
  } catch (error: any) {
    debugInfo.firebaseAdmin = {
      ...debugInfo.firebaseAdmin,
      firestoreProjectIdError: error?.message || "Could not resolve Firestore projectId.",
    };
  }

  return debugInfo;
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
