import { Router, type IRouter } from "express";
import healthRouter from "./health";
import customerSessionsRouter from "./customer-sessions";
import ordersRouter from "./orders";
import djRouter from "./dj";
import customerRequestsRouter from "./customer-requests";
import staffAdministrationRouter from "./staff-administration";
import realtimeRouter from "./realtime";
import kitchenRouter from "./kitchen";

const router: IRouter = Router();

router.use(healthRouter);
router.use(customerSessionsRouter);
router.use(ordersRouter);
router.use(djRouter);
router.use(customerRequestsRouter);
router.use(staffAdministrationRouter);
router.use(realtimeRouter);
router.use(kitchenRouter);

export default router;
