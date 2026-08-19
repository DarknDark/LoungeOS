import { Router, type IRouter } from "express";
import healthRouter from "./health";
import customerSessionsRouter from "./customer-sessions";
import ordersRouter from "./orders";
import djRouter from "./dj";
import staffAdministrationRouter from "./staff-administration";
import realtimeRouter from "./realtime";

const router: IRouter = Router();

router.use(healthRouter);
router.use(customerSessionsRouter);
router.use(ordersRouter);
router.use(djRouter);
router.use(staffAdministrationRouter);
router.use(realtimeRouter);

export default router;
