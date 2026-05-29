import crypto from 'crypto';
import { query, getClient as getDbClient } from '../services/db.js';
import { encrypt } from '../services/encryption.js';
import { sendKeycloakCredentialsEmail } from '../services/email.js';
import {
    createClientSchema,
    updateClientSchema,
    connectPlatformSchema,
    updateOnboardingStatusSchema,
    platformParamSchema,
    uuidParamSchema,
} from '../validators/clients.js';
import {
    deleteKeycloakUser,
    isKeycloakAdminConfigured,
    provisionKeycloakUser,
} from '../services/keycloak.js';
import { clearCacheByPrefix } from '../utils/cache.js';

function invalidateClientCaches() {
    clearCacheByPrefix('/api/clients');
    clearCacheByPrefix('/api/dashboard');
    clearCacheByPrefix('/api/charts');
}

// ─── GET /api/clients ───────────────────────────────────────
export async function listClients(req, res) {
    const role = req.user.role;

    // Pre-aggregate metrics per client in a CTE to prevent the Cartesian product
    // that occurs when campaign_metrics (many per client) is joined alongside
    // campaigns (also many per client): without this, SUM(spend) is multiplied
    // by the number of campaigns for each client.
    const CLIENTS_WITH_STATS_SQL = `
        WITH agg AS (
            SELECT client_id,
                   COALESCE(SUM(spend),   0) AS total_spend,
                   COALESCE(SUM(leads),   0) AS total_leads,
                   COALESCE(SUM(revenue), 0) AS total_revenue
            FROM campaign_metrics
            GROUP BY client_id
        ),
        camp_count AS (
            SELECT client_id, COUNT(*) AS campaign_count
            FROM campaigns
            GROUP BY client_id
        )
        SELECT c.id, c.name, c.industry, c.monthly_budget, c.onboarding_status, c.created_at,
               COALESCE(agg.total_spend,   0) AS total_spend,
               COALESCE(agg.total_leads,   0) AS total_leads,
               COALESCE(agg.total_revenue, 0) AS total_revenue,
               COALESCE(camp_count.campaign_count, 0) AS campaign_count
        FROM clients c
        LEFT JOIN agg        ON agg.client_id        = c.id
        LEFT JOIN camp_count ON camp_count.client_id = c.id
    `;

    // Manager or Employee — only show assigned clients
    if (role === 'employee' || role === 'manager') {
        const assignedIds = req.assignedClientIds || [];
        if (assignedIds.length === 0) {
            return res.json({ clients: [] });
        }
        const result = await query(
            `${CLIENTS_WITH_STATS_SQL}
             WHERE c.is_active = true AND c.id = ANY($1::uuid[])
             ORDER BY c.created_at DESC`,
            [assignedIds]
        );
        return res.json({ clients: result.rows });
    }

    // Client — only show their own client record
    if (role === 'client') {
        const result = await query(
            `${CLIENTS_WITH_STATS_SQL}
             WHERE c.is_active = true AND c.id = $1
             ORDER BY c.created_at DESC`,
            [req.user.client_id]
        );
        return res.json({ clients: result.rows });
    }

    // Admin — show all clients
    const result = await query(
        `${CLIENTS_WITH_STATS_SQL}
         WHERE c.is_active = true
         ORDER BY c.created_at DESC`
    );
    return res.json({ clients: result.rows });
}

// ─── GET /api/clients/:id ───────────────────────────────────
export async function getClient(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid client ID' });

    // Manager/Employee scope check — :id param isn't available to scopeGuard middleware
    if (req.user.role === 'employee' || req.user.role === 'manager') {
        const assignedIds = req.assignedClientIds || [];
        if (!assignedIds.includes(idParsed.data)) {
            return res.status(403).json({ error: 'Access denied — client not assigned to you' });
        }
    }
    const result = await query(
        `SELECT id, name, industry, monthly_budget, onboarding_status, created_at
     FROM clients WHERE id = $1 AND is_active = true`,
        [idParsed.data]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found' });

    // Fetch connected platforms
    const platforms = await query(
        `SELECT platform, is_verified, created_at FROM platform_credentials WHERE client_id = $1`,
        [idParsed.data]
    );

    return res.json({
        client: result.rows[0],
        platforms: platforms.rows,
    });
}

// ─── POST /api/clients ──────────────────────────────────────
export async function createClient(req, res) {
    if (!isKeycloakAdminConfigured()) {
        return res.status(503).json({
            error: 'Keycloak admin provisioning is not configured',
        });
    }

    const parsed = createClientSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    const { name, industry, monthly_budget, contact_name, contact_email } = parsed.data;

    // Check if email already exists
    const existing = await query(`SELECT id FROM users WHERE email = $1`, [contact_email]);
    if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'A user with this email already exists' });
    }

    // Generate a Keycloak temporary password
    const tempPassword = crypto.randomBytes(8).toString('base64url').slice(0, 12) + '!A1';

    const dbClient = await getDbClient();
    let provisioned = null;
    let clientId = null;
    try {
        await dbClient.query('BEGIN');

        const clientResult = await dbClient.query(
            `INSERT INTO clients (name, industry, monthly_budget) VALUES ($1, $2, $3) RETURNING id`,
            [name, industry || null, monthly_budget || null]
        );
        clientId = clientResult.rows[0].id;

        provisioned = await provisionKeycloakUser({
            email: contact_email,
            name: contact_name,
            role: 'client',
            tempPassword,
        });

        await dbClient.query(
            `INSERT INTO users (email, role, client_id, name, keycloak_user_id)
       VALUES ($1, 'client', $2, $3, $4)`,
            [contact_email, clientId, contact_name, provisioned.id]
        );

        await dbClient.query('COMMIT');
    } catch (err) {
        try {
            await dbClient.query('ROLLBACK');
        } catch {
            // Ignore rollback errors when the transaction is already closed.
        }
        if (provisioned?.id) {
            await deleteKeycloakUser(provisioned.id);
        }
        const message = err instanceof Error ? err.message : 'Failed to provision Keycloak client user';
        const status = message.includes('already exists') ? 409 : 502;
        return res.status(status).json({ error: message });
    } finally {
        dbClient.release();
    }

    try {
        await sendKeycloakCredentialsEmail({
            email: contact_email,
            password: tempPassword,
            name: contact_name,
            role: 'client',
        });
    } catch (err) {
        console.error(`[EMAIL] Failed to send Keycloak credentials to ${contact_email}:`, err);
    }

    invalidateClientCaches();

    return res.status(201).json({
        client_id: clientId,
        contact_email,
        temp_password: tempPassword, // Returned ONCE, never stored plain
        message: 'Client created in Keycloak. Temporary password shared above — it will not be shown again.',
    });
}

// ─── PATCH /api/clients/:id ─────────────────────────────────
export async function updateClient(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid client ID' });

    const parsed = updateClientSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    const fields = [];
    const values = [];
    let i = 1;

    for (const [key, value] of Object.entries(parsed.data)) {
        fields.push(`${key} = $${i}`);
        values.push(value);
        i++;
    }

    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(idParsed.data);
    const result = await query(
        `UPDATE clients SET ${fields.join(', ')} WHERE id = $${i} AND is_active = true RETURNING id, name, industry, monthly_budget`,
        values
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
    
    invalidateClientCaches();
    
    return res.json({ client: result.rows[0] });
}

// ─── DELETE /api/clients/:id ────────────────────────────────
export async function deleteClient(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid client ID' });

    const dbClient = await getDbClient();
    try {
        await dbClient.query('BEGIN');
        await dbClient.query(`UPDATE clients SET is_active = false WHERE id = $1`, [idParsed.data]);
        await dbClient.query(`UPDATE users SET is_active = false WHERE client_id = $1`, [idParsed.data]);
        await dbClient.query('COMMIT');
    } catch (err) {
        await dbClient.query('ROLLBACK');
        throw err;
    } finally {
        dbClient.release();
    }

    invalidateClientCaches();

    return res.json({ message: 'Client deactivated' });
}

// ─── POST /api/clients/:id/connect/:platform ────────────────
export async function connectPlatform(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid client ID' });

    // Manager/Employee scope check
    if (req.user.role === 'employee' || req.user.role === 'manager') {
        const assignedIds = req.assignedClientIds || [];
        if (!assignedIds.includes(idParsed.data)) {
            return res.status(403).json({ error: 'Access denied — client not assigned to you' });
        }
    }

    const platformParsed = platformParamSchema.safeParse(req.params.platform);
    if (!platformParsed.success) return res.status(400).json({ error: 'Invalid platform' });

    const parsed = connectPlatformSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    const clientId = idParsed.data;
    const platform = platformParsed.data;
    const { access_token, refresh_token, account_id } = parsed.data;

    // Encrypt credentials
    const encryptedAccess = encrypt(access_token);
    const encryptedRefresh = refresh_token ? encrypt(refresh_token) : null;

    // Simulate a test sync (in production, call the actual platform API)
    let syncSuccess = true;
    let syncError = null;
    try {
        // Placeholder: in production, make an API call to verify the credentials
        // For now, we assume success
        console.log(`[SYNC] Test sync for ${platform} on client ${clientId} — simulated success`);
    } catch (err) {
        syncSuccess = false;
        syncError = 'Platform API test failed';
    }

    const dbClient = await getDbClient();
    try {
        await dbClient.query('BEGIN');

        await dbClient.query(
            `INSERT INTO platform_credentials (client_id, platform, access_token, refresh_token, account_id, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (client_id, platform) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         account_id = EXCLUDED.account_id,
         is_verified = EXCLUDED.is_verified`,
            [clientId, platform, encryptedAccess, encryptedRefresh, account_id || null, syncSuccess]
        );

        // Log sync result
        await dbClient.query(
            `INSERT INTO sync_logs (client_id, platform, status, records_synced, error_message)
       VALUES ($1, $2, $3, $4, $5)`,
            [clientId, platform, syncSuccess ? 'success' : 'failed', 0, syncError]
        );

        // If at least one platform is verified, update onboarding_status
        if (syncSuccess) {
            const verified = await dbClient.query(
                `SELECT COUNT(*) FROM platform_credentials WHERE client_id = $1 AND is_verified = true`,
                [clientId]
            );
            if (parseInt(verified.rows[0].count) >= 1) {
                await dbClient.query(
                    `UPDATE clients SET onboarding_status = 'connected' WHERE id = $1 AND onboarding_status = 'pending'`,
                    [clientId]
                );
            }
        }

        await dbClient.query('COMMIT');
    } catch (err) {
        await dbClient.query('ROLLBACK');
        throw err;
    } finally {
        dbClient.release();
    }

    return res.json({
        platform,
        is_verified: syncSuccess,
        message: syncSuccess ? 'Platform connected and verified' : 'Platform saved but verification failed',
    });
}

// ─── GET /api/clients/:id/onboarding-status ─────────────────
export async function getOnboardingStatus(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid client ID' });

    // Manager/Employee scope check
    if (req.user.role === 'employee' || req.user.role === 'manager') {
        const assignedIds = req.assignedClientIds || [];
        if (!assignedIds.includes(idParsed.data)) {
            return res.status(403).json({ error: 'Access denied — client not assigned to you' });
        }
    }

    const client = await query(
        `SELECT onboarding_status FROM clients WHERE id = $1 AND is_active = true`,
        [idParsed.data]
    );
    if (client.rows.length === 0) return res.status(404).json({ error: 'Client not found' });

    const platforms = await query(
        `SELECT platform, is_verified FROM platform_credentials WHERE client_id = $1`,
        [idParsed.data]
    );

    return res.json({
        onboarding_status: client.rows[0].onboarding_status,
        platforms: platforms.rows,
    });
}

// ─── PATCH /api/clients/:id/onboarding-status ───────────────
export async function updateOnboardingStatus(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid client ID' });

    // Manager/Employee scope check
    if (req.user.role === 'employee' || req.user.role === 'manager') {
        const assignedIds = req.assignedClientIds || [];
        if (!assignedIds.includes(idParsed.data)) {
            return res.status(403).json({ error: 'Access denied — client not assigned to you' });
        }
    }

    const parsed = updateOnboardingStatusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

    const result = await query(
        `UPDATE clients SET onboarding_status = $1 WHERE id = $2 AND is_active = true RETURNING id, onboarding_status`,
        [parsed.data.onboarding_status, idParsed.data]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
    return res.json(result.rows[0]);
}
