// Controller for free-form email composition — custom subject, body, and file attachments via Gmail.
import multer from 'multer';
import { decrypt } from '../services/encryption.js';
import { sendGmailMessage } from '../services/email.js';
import { query } from '../services/db.js';

// Store attachments in memory (max 10 MB total, 5 files)
export const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

async function getUserGmailConnection(userId) {
    const result = await query(
        `SELECT gmail_email, encrypted_refresh_token
         FROM user_gmail_connections
         WHERE user_id = $1`,
        [userId],
    );
    return result.rows[0] || null;
}

export async function sendComposeEmail(req, res) {
    const { to, subject, body } = req.body || {};
    const files = req.files || [];

    // ── Validate ──────────────────────────────────────────────
    if (!to || typeof to !== 'string' || !to.trim()) {
        return res.status(400).json({ error: 'Recipient email address is required' });
    }

    const toAddresses = to.split(',').map((addr) => addr.trim()).filter(Boolean);
    if (toAddresses.length === 0) {
        return res.status(400).json({ error: 'At least one valid recipient is required' });
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = toAddresses.find((addr) => !emailRegex.test(addr));
    if (invalid) {
        return res.status(400).json({ error: `Invalid email address: ${invalid}` });
    }

    if (!subject || typeof subject !== 'string' || !subject.trim()) {
        return res.status(400).json({ error: 'Subject is required' });
    }

    if (!body || typeof body !== 'string' || !body.trim()) {
        return res.status(400).json({ error: 'Email body is required' });
    }

    // ── Gmail connection ──────────────────────────────────────
    const connection = await getUserGmailConnection(req.user.user_id);
    if (!connection) {
        return res.status(409).json({
            error: 'Connect Gmail before sending emails',
            code: 'GMAIL_NOT_CONNECTED',
        });
    }

    const refreshToken = decrypt(connection.encrypted_refresh_token);

    // ── Build attachments ─────────────────────────────────────
    const attachments = files.map((file) => ({
        filename: file.originalname,
        contentType: file.mimetype || 'application/octet-stream',
        content: file.buffer,
    }));

    // ── Send to each recipient ────────────────────────────────
    const results = [];
    for (const recipient of toAddresses) {
        try {
            const message = await sendGmailMessage({
                from: connection.gmail_email,
                refreshToken,
                to: recipient,
                subject: subject.trim(),
                html: `<div style="font-family:sans-serif;white-space:pre-wrap">${body.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`,
                text: body.trim(),
                attachments,
            });
            results.push({ to: recipient, status: 'sent', message_id: message.id });
        } catch (err) {
            console.error(`[COMPOSE-EMAIL] Failed to send to ${recipient}:`, err.message);
            results.push({ to: recipient, status: 'failed', error: err.message });
        }
    }

    const failed = results.filter((r) => r.status === 'failed');
    return res.status(failed.length && failed.length === results.length ? 500 : failed.length ? 207 : 200).json({
        status: failed.length === 0 ? 'sent' : failed.length === results.length ? 'failed' : 'partial',
        sent_count: results.length - failed.length,
        failed_count: failed.length,
        from: connection.gmail_email,
        results,
    });
}
