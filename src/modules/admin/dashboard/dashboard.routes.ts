import { Router } from 'express';
import { getDashboardMetrics } from './dashboard.controller';

const router = Router();

router.get('/', getDashboardMetrics);

export default router;
