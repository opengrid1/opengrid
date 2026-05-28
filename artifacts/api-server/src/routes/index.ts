import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import cliStatusRouter from "./cli-status";
import filesRouter from "./files";

const router: IRouter = Router();

// Public routes (no auth) — health probe and auth check/login.
router.use(healthRouter);
router.use(authRouter);

// cli-status is just booleans about CLI availability — not sensitive.
router.use(cliStatusRouter);

// Files routes apply their own requireAuth middleware internally.
router.use(filesRouter);

export default router;
