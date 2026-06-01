export type PlanRecord = {
  id: string;
  ownerEmail: string;
  name: string;
  mode: string;
  config: unknown;
  createdAt: string | null;
  updatedAt: string | null;
};

export type CreatePlanInput = {
  name: string;
  mode: string;
  config: unknown;
};

export type UpdatePlanInput = Partial<CreatePlanInput>;
