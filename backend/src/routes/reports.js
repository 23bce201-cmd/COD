import { Router } from 'express';
import { getPdfReport, getAnalyticsReport } from '../controllers/reports.js';

const router = Router();

router.get('/pdf/:client_id', getPdfReport);
router.get('/pdf', getPdfReport);
router.get('/analytics', getAnalyticsReport);

export default router;
