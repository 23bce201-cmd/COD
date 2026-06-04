// Route for free-form email composition with file attachments.
import { Router } from 'express';
import { sendComposeEmail, upload } from '../controllers/composeEmail.js';

const router = Router();

// POST /api/email/compose  — multipart/form-data: to, subject, body, files[]
router.post('/compose', upload.array('files', 5), sendComposeEmail);

export default router;
