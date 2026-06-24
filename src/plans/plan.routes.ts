import { Router, type Request, type Response } from "express";
import { requireActiveCurrentUser } from "../auth/current-user.js";
import {
  createPlan,
  deletePlan,
  listPlans,
  listPublicPlans,
  PlanForbiddenError,
  updatePlan,
} from "./plan.service.js";
import type { CreatePlanInput, PlanVisibility, UpdatePlanInput } from "./plan.types.js";

const router = Router();

function isAllQueryEnabled(req: Request): boolean {
  return req.query.all === "1";
}

function readRequiredString(value: unknown): string | null {
  const text = String(value || "").trim();
  return text || null;
}

function readOptionalString(value: unknown, maxLength: number): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

function readVisibility(value: unknown): PlanVisibility | null {
  if (value === undefined) {
    return "private";
  }

  return value === "public" || value === "private" ? value : null;
}

function readCreatePlanInput(body: any): CreatePlanInput | null {
  const name = readRequiredString(body?.name);
  const mode = readRequiredString(body?.mode);
  const visibility = readVisibility(body?.visibility);

  if (!name || !mode || !visibility) {
    return null;
  }

  return {
    name,
    mode,
    description: readOptionalString(body?.description, 280),
    visibility,
    config: body?.config ?? {},
  };
}

function readUpdatePlanInput(body: any): UpdatePlanInput | null {
  const input: UpdatePlanInput = {};

  if (body?.name !== undefined) {
    const name = readRequiredString(body.name);

    if (!name) {
      return null;
    }

    input.name = name;
  }

  if (body?.mode !== undefined) {
    const mode = readRequiredString(body.mode);

    if (!mode) {
      return null;
    }

    input.mode = mode;
  }

  if (body?.config !== undefined) {
    input.config = body.config;
  }

  if (body?.description !== undefined) {
    input.description = readOptionalString(body.description, 280);
  }

  if (body?.visibility !== undefined) {
    const visibility = readVisibility(body.visibility);

    if (!visibility) {
      return null;
    }

    input.visibility = visibility;
  }

  return Object.keys(input).length ? input : null;
}

function sendRouteError(res: Response, error: unknown): void {
  if (error instanceof PlanForbiddenError) {
    res.status(403).json({ error: "Plan access denied" });
    return;
  }

  res.status(500).json({ error: "Plans request failed" });
}

router.get("/", async (req, res) => {
  try {
    const user = await requireActiveCurrentUser(req, res);

    if (!user) {
      return;
    }

    const plans = await listPlans(user, isAllQueryEnabled(req));
    res.json({ plans });
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.get("/public", async (req, res) => {
  try {
    const user = await requireActiveCurrentUser(req, res);

    if (!user) {
      return;
    }

    const plans = await listPublicPlans();
    res.json({ plans });
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.post("/", async (req, res) => {
  try {
    const user = await requireActiveCurrentUser(req, res);

    if (!user) {
      return;
    }

    const input = readCreatePlanInput(req.body);

    if (!input) {
      res.status(400).json({ error: "Plan name and mode are required" });
      return;
    }

    const plan = await createPlan(user, input);
    res.status(201).json({ plan });
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const user = await requireActiveCurrentUser(req, res);

    if (!user) {
      return;
    }

    const input = readUpdatePlanInput(req.body);

    if (!input) {
      res.status(400).json({ error: "No valid plan updates provided" });
      return;
    }

    const plan = await updatePlan(user, req.params.id, input);

    if (!plan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    res.json({ plan });
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const user = await requireActiveCurrentUser(req, res);

    if (!user) {
      return;
    }

    const deleted = await deletePlan(user, req.params.id);

    if (!deleted) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }

    res.json({ ok: true });
  } catch (error) {
    sendRouteError(res, error);
  }
});

export default router;
