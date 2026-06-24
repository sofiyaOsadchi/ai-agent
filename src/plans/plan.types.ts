export type PlanVisibility = "private" | "public";

export type PlanRecord = {
  id: string;
  ownerEmail: string;
  ownerDisplayName?: string;
  name: string;
  mode: string;
  description?: string;
  visibility: PlanVisibility;
  config: unknown;
  createdAt: string | null;
  updatedAt: string | null;
  sharedAt?: string | null;
};

export type PublicPlanRecord = Omit<PlanRecord, "config" | "ownerEmail"> & {
  ownerEmail?: never;
};

export type CreatePlanInput = {
  name: string;
  mode: string;
  description?: string;
  visibility?: PlanVisibility;
  config: unknown;
};

export type UpdatePlanInput = Partial<CreatePlanInput>;
