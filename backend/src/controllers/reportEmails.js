// Report email API controller for recipient discovery, Gmail delivery, scheduling, and sent-email logging.
import crypto from 'crypto';
import { query } from '../services/db.js';
import { decrypt, encrypt } from '../services/encryption.js';
import { buildUserGmailAuthUrl, exchangeGmailAuthCode, sendGmailMessage } from '../services/email.js';
import { generateClientReportBuffer } from '../services/pdf.js';
import { buildReportEmailTemplate } from '../templates/reportEmailTemplate.js';
import { uuidParamSchema } from '../validators/clients.js';

const SEND_TIMERS = new Map();
const ROLE_LABELS = {
    agency_admin: 'Admin',
    admin: 'Admin',
    manager: 'Manager',
    employee: 'Employee',
    client: 'Client',
};

function mapDbRole(role) {
    return role === 'agency_admin' ? 'admin' : role;
}

function normalizeRecipient(row) {
    return {
        id: row.id,
        name: row.name || row.email,
        email: row.email,
        role: mapDbRole(row.role),
        roleLabel: ROLE_LABELS[row.role] || row.role,
        client_id: row.client_id,
        client_name: row.client_name || null,
    };
}

function parseDate(value, fallback) {
    if (!value) return fallback;
    return String(value).slice(0, 10);
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}

function defaultDateRange() {
    const to = new Date();
    const from = addDays(to, -30);
    return {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
    };
}

function buildScope(req) {
    return {
        role: req.user.role,
        clientId: req.user.client_id,
        assignedClientIds: req.assignedClientIds || [],
    };
}

function getFrontendOrigin() {
    return process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
}

function sanitizeReturnTo(value) {
    const fallback = `${getFrontendOrigin()}/`;
    if (!value) return fallback;

    try {
        const parsed = new URL(value);
        if (parsed.origin !== getFrontendOrigin()) return fallback;
        return parsed.toString();
    } catch {
        return fallback;
    }
}

function appendQuery(url, params) {
    const parsed = new URL(url);
    Object.entries(params).forEach(([key, value]) => parsed.searchParams.set(key, value));
    return parsed.toString();
}

function oauthErrorReason(err) {
    const data = err?.response?.data;

    // Only use string values — Google sometimes returns error fields as objects
    const rawReason =
        (typeof data?.error_description === 'string' ? data.error_description : null) ||
        (typeof data?.error === 'string' ? data.error : null) ||
        (typeof err?.message === 'string' ? err.message : null) ||
        'oauth_exchange_failed';

    return rawReason
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 120) || 'oauth_exchange_failed';
}

async function getUserGmailConnection(userId) {
    const result = await query(
        `SELECT user_id, gmail_email, encrypted_refresh_token, connected_at
         FROM user_gmail_connections
         WHERE user_id = $1`,
        [userId],
    );

    return result.rows[0] || null;
}

async function requireUserGmailConnection(userId) {
    const connection = await getUserGmailConnection(userId);
    if (!connection) {
        const error = new Error('Connect Gmail before sending report emails');
        error.statusCode = 409;
        error.code = 'GMAIL_NOT_CONNECTED';
        throw error;
    }

    return {
        gmailEmail: connection.gmail_email,
        refreshToken: decrypt(connection.encrypted_refresh_token),
    };
}

async function getAccessibleRecipients(req, clientId = null) {
    const role = req.user.role;
    const userId = req.user.user_id;
    const params = [];
    const conditions = ['u.is_active = true', 'u.email IS NOT NULL', "u.email <> ''"];

    if (clientId) {
        params.push(clientId);
        conditions.push(`(
            u.role IN ('agency_admin')
            OR u.client_id = $${params.length}
            OR EXISTS (
                SELECT 1 FROM manager_client_assignments mca
                WHERE mca.manager_id = u.id AND mca.client_id = $${params.length}
            )
            OR EXISTS (
                SELECT 1 FROM campaigns c
                JOIN employee_campaign_assignments eca ON eca.campaign_id = c.id
                WHERE eca.employee_id = u.id AND c.client_id = $${params.length}
            )
        )`);
    } else if (role === 'admin') {
        conditions.push('true');
    } else if (role === 'manager') {
        params.push(userId);
        conditions.push(`(
            u.id = $${params.length}
            OR u.role = 'agency_admin'
            OR u.manager_id = $${params.length}
            OR u.client_id IN (SELECT client_id FROM manager_client_assignments WHERE manager_id = $${params.length})
        )`);
    } else if (role === 'employee') {
        params.push(userId);
        conditions.push(`(
            u.id = $${params.length}
            OR u.id = (SELECT manager_id FROM users WHERE id = $${params.length})
            OR u.client_id IN (
                SELECT DISTINCT c.client_id
                FROM campaigns c
                JOIN employee_campaign_assignments eca ON eca.campaign_id = c.id
                WHERE eca.employee_id = $${params.length}
            )
        )`);
    } else if (role === 'client') {
        params.push(req.user.client_id);
        conditions.push(`(
            u.client_id = $${params.length}
            OR EXISTS (
                SELECT 1 FROM manager_client_assignments mca
                WHERE mca.manager_id = u.id AND mca.client_id = $${params.length}
            )
            OR EXISTS (
                SELECT 1 FROM campaigns c
                JOIN employee_campaign_assignments eca ON eca.campaign_id = c.id
                WHERE eca.employee_id = u.id AND c.client_id = $${params.length}
            )
        )`);
    }

    // Wrap in a subquery so ORDER BY CASE works with DISTINCT (PostgreSQL requires
    // ORDER BY expressions to appear in the SELECT list when using DISTINCT).
    const result = await query(
        `SELECT * FROM (
            SELECT DISTINCT u.id, u.name, u.email, u.role, u.client_id, cl.name AS client_name
            FROM users u
            LEFT JOIN clients cl ON cl.id = u.client_id
            WHERE ${conditions.join(' AND ')}
         ) sub
         ORDER BY
            CASE role
                WHEN 'agency_admin' THEN 1
                WHEN 'manager' THEN 2
                WHEN 'employee' THEN 3
                WHEN 'client' THEN 4
                ELSE 5
            END,
            name NULLS LAST,
            email`,
        params,
    );

    return result.rows.map(normalizeRecipient);
}

async function insertEmailLog({
    senderUserId,
    clientId,
    recipient,
    subject,
    reportTitle,
    from,
    to,
    attachmentFilename,
    status,
    scheduledFor,
    providerMessageId,
    errorMessage,
    metadata,
    senderEmail,
}) {
    const sentAt = status === 'sent' ? new Date() : null;
    const result = await query(
        `INSERT INTO sent_emails (
            sender_user_id,
            sender_email,
            client_id,
            recipient_user_id,
            recipient_email,
            subject,
            report_title,
            report_from,
            report_to,
            attachment_filename,
            status,
            scheduled_for,
            sent_at,
            provider_message_id,
            error_message,
            metadata
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
         RETURNING id`,
        [
            senderUserId,
            senderEmail || null,
            clientId,
            recipient.id,
            recipient.email,
            subject,
            reportTitle,
            from,
            to,
            attachmentFilename,
            status,
            scheduledFor,
            sentAt,
            providerMessageId || null,
            errorMessage || null,
            metadata ? JSON.stringify(metadata) : null,
        ],
    );

    return result.rows[0].id;
}

async function updateEmailLog(id, { status, providerMessageId, errorMessage, attachmentFilename }) {
    const sentAt = status === 'sent' ? new Date() : null;
    await query(
        `UPDATE sent_emails
         SET status = $2,
             sent_at = COALESCE($3, sent_at),
             provider_message_id = $4,
             error_message = $5,
             attachment_filename = COALESCE($6, attachment_filename)
         WHERE id = $1`,
        [id, status, sentAt, providerMessageId || null, errorMessage || null, attachmentFilename || null],
    );
}

async function sendReportToRecipients({ req, recipients, clientId, from, to, title, note, logIds = [], senderConnection }) {
    const effectiveSenderConnection = senderConnection || await requireUserGmailConnection(req.user.user_id);
    const reportPdf = await generateClientReportBuffer(clientId || null, from, to, {
        title,
        clientName: clientId ? undefined : 'All Clients',
        scope: buildScope(req),
    });

    const subject = `${title} - ${reportPdf.clientName} (${from} to ${to})`;
    const results = [];

    for (const [index, recipient] of recipients.entries()) {
        try {
            const html = buildReportEmailTemplate({
                recipientName: recipient.name,
                senderName: req.user.email,
                reportTitle: title,
                clientName: reportPdf.clientName,
                from,
                to,
                summary: reportPdf.summary,
                note,
            });
            const message = await sendGmailMessage({
                from: effectiveSenderConnection.gmailEmail,
                refreshToken: effectiveSenderConnection.refreshToken,
                to: recipient.email,
                subject,
                html,
                text: `${title} for ${reportPdf.clientName} (${from} to ${to}) is attached.`,
                attachments: [{
                    filename: reportPdf.filename,
                    contentType: 'application/pdf',
                    content: reportPdf.buffer,
                }],
            });

            if (logIds[index]) {
                await updateEmailLog(logIds[index], {
                    status: 'sent',
                    providerMessageId: message.id,
                    attachmentFilename: reportPdf.filename,
                });
            }

            results.push({ recipient_id: recipient.id, email: recipient.email, status: 'sent', message_id: message.id });
        } catch (err) {
            if (logIds[index]) {
                await updateEmailLog(logIds[index], {
                    status: 'failed',
                    errorMessage: err.message,
                });
            }
            results.push({ recipient_id: recipient.id, email: recipient.email, status: 'failed', error: err.message });
        }
    }

    return { reportPdf, subject, results, senderEmail: effectiveSenderConnection.gmailEmail };
}

export async function getGmailConnectionStatus(req, res) {
    const connection = await getUserGmailConnection(req.user.user_id);

    res.json({
        connected: Boolean(connection),
        gmail_email: connection?.gmail_email || null,
        connected_at: connection?.connected_at || null,
    });
}

export async function createGmailAuthUrl(req, res) {
    const state = crypto.randomBytes(24).toString('base64url');
    const returnTo = sanitizeReturnTo(req.body?.return_to);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await query(
        `INSERT INTO gmail_oauth_states (state, user_id, return_to, expires_at)
         VALUES ($1, $2, $3, $4)`,
        [state, req.user.user_id, returnTo, expiresAt],
    );

    res.json({ auth_url: buildUserGmailAuthUrl({ state }) });
}

export async function handleGmailOAuthCallback(req, res) {
    const { code, state, error } = req.query;
    const fallback = `${getFrontendOrigin()}/`;

    if (error) {
        return res.redirect(appendQuery(fallback, { gmail: 'error', reason: String(error) }));
    }

    if (!code || !state) {
        return res.redirect(appendQuery(fallback, { gmail: 'error', reason: 'missing_oauth_response' }));
    }

    const stateResult = await query(
        `DELETE FROM gmail_oauth_states
         WHERE state = $1 AND expires_at > now()
         RETURNING user_id, return_to`,
        [state],
    );
    const stateRow = stateResult.rows[0];

    if (!stateRow) {
        return res.redirect(appendQuery(fallback, { gmail: 'error', reason: 'expired_state' }));
    }

    try {
        const { tokens, gmailEmail } = await exchangeGmailAuthCode(String(code));
        if (!tokens.refresh_token) {
            return res.redirect(appendQuery(stateRow.return_to || fallback, { gmail: 'error', reason: 'missing_refresh_token' }));
        }

        await query(
            `INSERT INTO user_gmail_connections (
                user_id,
                gmail_email,
                encrypted_refresh_token,
                scope,
                token_type,
                connected_at,
                updated_at
             )
             VALUES ($1, $2, $3, $4, $5, now(), now())
             ON CONFLICT (user_id) DO UPDATE SET
                gmail_email = EXCLUDED.gmail_email,
                encrypted_refresh_token = EXCLUDED.encrypted_refresh_token,
                scope = EXCLUDED.scope,
                token_type = EXCLUDED.token_type,
                updated_at = now()`,
            [
                stateRow.user_id,
                gmailEmail,
                encrypt(tokens.refresh_token),
                tokens.scope || null,
                tokens.token_type || null,
            ],
        );

        return res.redirect(appendQuery(stateRow.return_to || fallback, { gmail: 'connected' }));
    } catch (err) {
        console.error('[GMAIL-OAUTH] callback failed:', err.message);
        console.error('[GMAIL-OAUTH] response data:', JSON.stringify(err?.response?.data ?? null));
        console.error('[GMAIL-OAUTH] full error:', err?.errors ?? err?.stack ?? err);
        return res.redirect(appendQuery(stateRow.return_to || fallback, { gmail: 'error', reason: oauthErrorReason(err) }));
    }
}

function scheduleReportSend({ logIds, delayMs, sendTask }) {
    const timer = setTimeout(async () => {
        SEND_TIMERS.delete(logIds.join(','));
        try {
            await sendTask();
        } catch (err) {
            await Promise.all(logIds.map((id) => updateEmailLog(id, {
                status: 'failed',
                errorMessage: err.message,
            })));
        }
    }, delayMs);

    SEND_TIMERS.set(logIds.join(','), timer);
}

export async function getReportEmailRecipients(req, res) {
    const requestedClientId = req.query.client_id || req.scopedClientId || null;
    if (requestedClientId) {
        const parsed = uuidParamSchema.safeParse(requestedClientId);
        if (!parsed.success) return res.status(400).json({ error: 'Invalid client ID' });
    }

    const recipients = await getAccessibleRecipients(req, requestedClientId);
    res.json({ recipients });
}

export async function sendReportEmail(req, res) {
    const {
        recipient_ids: recipientIds = [],
        client_id: requestedClientId = null,
        from: rawFrom,
        to: rawTo,
        title: rawTitle,
        note,
        scheduled_at: scheduledAt,
    } = req.body || {};

    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
        return res.status(400).json({ error: 'Select at least one recipient' });
    }

    const clientId = req.scopedClientId || requestedClientId || null;
    if (clientId) {
        const parsed = uuidParamSchema.safeParse(clientId);
        if (!parsed.success) return res.status(400).json({ error: 'Invalid client ID' });
    }

    const { from: defaultFrom, to: defaultTo } = defaultDateRange();
    const from = parseDate(rawFrom, defaultFrom);
    const to = parseDate(rawTo, defaultTo);
    const title = String(rawTitle || 'Performance Report').slice(0, 120);
    const accessibleRecipients = await getAccessibleRecipients(req, clientId);
    const selected = accessibleRecipients.filter((recipient) => recipientIds.includes(recipient.id));

    if (selected.length !== recipientIds.length) {
        return res.status(403).json({ error: 'One or more selected recipients are not available to your account' });
    }

    const scheduledFor = scheduledAt ? new Date(scheduledAt) : null;
    const shouldSchedule = scheduledFor && Number.isFinite(scheduledFor.getTime()) && scheduledFor.getTime() > Date.now() + 30000;
    const subject = `${title} (${from} to ${to})`;
    const metadata = {
        requested_by: req.user.email,
        mode: shouldSchedule ? 'scheduled' : 'immediate',
    };
    let senderConnection;

    try {
        senderConnection = await requireUserGmailConnection(req.user.user_id);
    } catch (err) {
        if (err.code === 'GMAIL_NOT_CONNECTED') {
            return res.status(409).json({
                error: err.message,
                code: err.code,
            });
        }
        throw err;
    }

    if (shouldSchedule) {
        const logIds = [];
        for (const recipient of selected) {
            const logId = await insertEmailLog({
                senderUserId: req.user.user_id,
                clientId,
                recipient,
                subject,
                reportTitle: title,
                from,
                to,
                attachmentFilename: null,
                status: 'scheduled',
                scheduledFor,
                metadata,
                senderEmail: senderConnection.gmailEmail,
            });
            logIds.push(logId);
        }

        scheduleReportSend({
            logIds,
            delayMs: scheduledFor.getTime() - Date.now(),
            sendTask: () => sendReportToRecipients({
                req,
                recipients: selected,
                clientId,
                from,
                to,
                title,
                note,
                logIds,
                senderConnection,
            }),
        });

        return res.status(202).json({
            status: 'scheduled',
            scheduled_at: scheduledFor.toISOString(),
            recipient_count: selected.length,
            log_ids: logIds,
        });
    }

    const { reportPdf, subject: deliveredSubject, results, senderEmail } = await sendReportToRecipients({
        req,
        recipients: selected,
        clientId,
        from,
        to,
        title,
        note,
        senderConnection,
    });

    const logIds = [];
    for (const result of results) {
        const recipient = selected.find((item) => item.id === result.recipient_id);
        const logId = await insertEmailLog({
            senderUserId: req.user.user_id,
            clientId,
            recipient,
            subject: deliveredSubject,
            reportTitle: title,
            from,
            to,
            attachmentFilename: reportPdf.filename,
            status: result.status,
            scheduledFor: null,
            providerMessageId: result.message_id,
            errorMessage: result.error,
            metadata,
            senderEmail,
        });
        logIds.push(logId);
    }

    const failed = results.filter((result) => result.status === 'failed');
    res.status(failed.length ? 207 : 200).json({
        status: failed.length ? 'partial' : 'sent',
        recipient_count: selected.length,
        sent_count: results.length - failed.length,
        failed_count: failed.length,
        results,
        log_ids: logIds,
    });
}
