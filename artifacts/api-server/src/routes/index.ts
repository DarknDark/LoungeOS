import { Router, type IRouter } from "express";
import healthRouter from "./health";
import customerSessionsRouter from "./customer-sessions";
import ordersRouter from "./orders";
import staffAdministrationRouter from "./staff-administration";

const router: IRouter = Router();

router.use(healthRouter);
router.use(customerSessionsRouter);
router.use(ordersRouter);
router.use(staffAdministrationRouter);

export default router;
