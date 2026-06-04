import { Router } from 'express';
import { archiveDeal, createDeal, listDeals, updateDeal } from '../controllers/kanban.js';
import { requireRole } from '../middleware/scopeGuard.js';

const router = Router();

router.use(requireRole('admin', 'manager'));
router.get('/deals', listDeals);
router.post('/deals', createDeal);
router.patch('/deals/:id', updateDeal);
router.delete('/deals/:id', archiveDeal);

export default router;
