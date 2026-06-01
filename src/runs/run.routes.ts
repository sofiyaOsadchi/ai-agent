import { Router, type Request, type Response } from "express";
import { requireActiveCurrentUser } from "../auth/current-user.js";
import { getRunById, listRuns, RunForbiddenError } from "./run.service.js";

const router = Router();

function isAllQueryEnabled(req: Request): boolean {
  return req.query.all === "1";
}

function sendRouteError(res: Response, error: unknown): void {
  if (error instanceof RunForbiddenError) {
    res.status(403).json({ error: "Run access denied" });
    return;
  }

  res.status(500).json({ error: "Runs request failed" });
}

router.get("/", async (req, res) => {
  try {
    const user = await requireActiveCurrentUser(req, res);

    if (!user) {
      return;
    }

    const runs = await listRuns(user, isAllQueryEnabled(req));
    res.json({ runs });
  } catch (error) {
    sendRouteError(res, error);
  }
});

router.get("/:id", async (req, res) => {
  try {
    const user = await requireActiveCurrentUser(req, res);

    if (!user) {
      return;
    }

    const run = await getRunById(user, req.params.id, isAllQueryEnabled(req));

    if (!run) {
      res.status(404).json({ error: "Run not found" });
      return;
    }

    res.json({ run });
  } catch (error) {
    sendRouteError(res, error);
  }
});

export default router;
