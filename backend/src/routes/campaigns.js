import { Router } from 'express';
import { listCampaigns, getCampaign, createCampaign, updateCampaign, deleteCampaign, setCampaignEmployees } from '../controllers/campaigns.js';
import { requireRole } from '../middleware/scopeGuard.js';

const router = Router();

router.get('/', listCampaigns);
router.get('/:id', getCampaign);
router.post('/', requireRole('admin', 'manager'), createCampaign);
router.patch('/:id', requireRole('admin', 'manager'), updateCampaign);
router.delete('/:id', requireRole('admin', 'manager'), deleteCampaign);
router.post('/:id/employees', requireRole('admin', 'manager'), setCampaignEmployees);

export default router;
