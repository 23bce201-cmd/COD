import { Router } from 'express';
import { performanceChart, platformSplit, agencySpend, managerPerformance } from '../controllers/charts.js';
import { requireRole } from '../middleware/scopeGuard.js';
import { cacheRoute } from '../utils/cache.js';

const router = Router();

router.get('/performance', cacheRoute(300), performanceChart);
router.get('/platform-split', cacheRoute(300), platformSplit);
router.get('/manager-performance', requireRole('admin', 'manager'), cacheRoute(300), managerPerformance);
router.get('/agency-spend', requireRole('admin', 'manager'), cacheRoute(300), agencySpend);

export default router;
