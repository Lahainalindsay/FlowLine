import { Router, type IRouter } from "express";
import healthRouter from "./health";
import flowlineRouter from "./flowline";

const router: IRouter = Router();

router.use(healthRouter);
router.use(flowlineRouter);

export default router;
