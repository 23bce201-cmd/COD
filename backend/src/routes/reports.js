// Routes for analytics reports, PDF downloads, and report email automation.
import { Router } from 'express';
import { getPdfReport, getAnalyticsReport } from '../controllers/reports.js';
import {
    createGmailAuthUrl,
    getGmailConnectionStatus,
    getReportEmailRecipients,
    sendReportEmail,
} from '../controllers/reportEmails.js';

const router = Router();

router.get('/email/recipients', getReportEmailRecipients);
router.get('/email/gmail/status', getGmailConnectionStatus);
router.post('/email/gmail/auth-url', createGmailAuthUrl);
router.post('/email/send', sendReportEmail);
router.get('/pdf/:client_id', getPdfReport);
router.get('/pdf', getPdfReport);
router.get('/analytics', getAnalyticsReport);

export default router;
