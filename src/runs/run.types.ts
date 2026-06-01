export type RunStatus = "running" | "completed" | "failed";

export type RunRecord = {
  id: string;
  userEmail: string;
  mode: string;
  planId?: string;
  status: RunStatus;
  startedAt: string | null;
  finishedAt?: string | null;
  configSnapshot: unknown;
  outputLinks?: unknown;
  errorMessage?: string;
};

export type CreateRunInput = {
  userEmail: string;
  mode: string;
  planId?: string;
  configSnapshot: unknown;
};

export type UpdateRunInput = {
  status?: RunStatus;
  finishedAt?: boolean;
  outputLinks?: unknown;
  errorMessage?: string;
};
