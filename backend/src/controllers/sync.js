import { query, getClient } from '../services/db.js';
import { decrypt } from '../services/encryption.js';
import { uuidParamSchema } from '../validators/clients.js';

const MOCK_API_BASE =
    process.env.MOCK_ADS_API_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:4000');

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/** Load & decrypt credentials for a given client + platform */
async function loadCredentials(clientId, platform) {
    const result = await query(
        `SELECT id, access_token, account_id, is_verified
         FROM platform_credentials
         WHERE client_id = $1 AND platform = $2`,
        [clientId, platform]
    );
    if (result.rows.length === 0) {
        if (MOCK_API_BASE.includes('localhost')) {
            console.log(`[Demo] Providing mock credentials for ${platform} - client ${clientId}`);
            const tokens = {
                'google_ads': 'mock_google_access_token_abc123',
                'meta_ads': 'mock_meta_access_token_def456',
                'linkedin_ads': 'mock_linkedin_access_token_ghi789',
                'twitter_ads': 'mock_twitter_access_token_jkl012'
            };
            return { accessToken: tokens[platform] || 'mock_token_123', accountId: `mock_act_${clientId}` };
        }
        throw Object.assign(new Error(`No credentials found for platform: ${platform}`), { code: 'NO_CREDENTIALS' });
    }
    const row = result.rows[0];
    if (!row.is_verified && !MOCK_API_BASE.includes('localhost')) {
        throw Object.assign(new Error(`Credentials not verified for platform: ${platform}`), { code: 'NOT_VERIFIED' });
    }
    return {
        accessToken: decrypt(row.access_token),
        accountId: row.account_id,
    };
}

/** Upsert a campaign row; returns its internal UUID */
async function upsertCampaign(db, clientId, platform, externalId, name, status, budget, startDate, endDate) {
    const result = await db.query(
        `INSERT INTO campaigns (client_id, name, platform, external_id, status, budget, start_date, end_date)
         VALUES ($1, $2, $3, $4, $5::campaign_status, $6, $7, $8)
         ON CONFLICT (client_id, platform, external_id)
         DO UPDATE SET
           name       = EXCLUDED.name,
           status     = EXCLUDED.status::campaign_status,
           budget     = EXCLUDED.budget,
           start_date = EXCLUDED.start_date,
           end_date   = EXCLUDED.end_date
         RETURNING id`,
        [clientId, name, platform, externalId, status, budget, startDate, endDate]
    );
    return result.rows[0].id;
}

/** Upsert a single daily metrics row */
async function upsertMetric(db, campaignId, clientId, date, metrics, source) {
    await db.query(
        `INSERT INTO campaign_metrics
           (campaign_id, client_id, date, spend, impressions, clicks, leads, reach, conversions, revenue, source, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::metric_source, now())
         ON CONFLICT (campaign_id, date) DO UPDATE SET
           spend       = EXCLUDED.spend,
           impressions = EXCLUDED.impressions,
           clicks      = EXCLUDED.clicks,
           leads       = EXCLUDED.leads,
           reach       = EXCLUDED.reach,
           conversions = EXCLUDED.conversions,
           revenue     = EXCLUDED.revenue,
           synced_at   = now()`,
        [
            campaignId, clientId, date,
            metrics.spend ?? null,
            metrics.impressions ?? null,
            metrics.clicks ?? null,
            metrics.leads ?? null,
            metrics.reach ?? null,
            metrics.conversions ?? null,
            metrics.revenue ?? null,
            source,
        ]
    );
}

/** Write a sync_log entry */
async function writeSyncLog(clientId, platform, success, records, errorMsg) {
    await query(
        `INSERT INTO sync_logs (client_id, platform, status, records_synced, error_message)
         VALUES ($1, $2, $3, $4, $5)`,
        [clientId, platform, success ? 'success' : 'failed', records, errorMsg ?? null]
    );
}

// ─────────────────────────────────────────────────────────────
// Google Ads Sync
// ─────────────────────────────────────────────────────────────
async function runGoogleSync(clientId) {
    const { accessToken, accountId } = await loadCredentials(clientId, 'google_ads');

    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN || 'mock-dev-token',
    };

    // 1. Fetch campaigns
    const campRes = await fetch(
        `${MOCK_API_BASE}/api/google-ads/campaigns${accountId ? `?clientId=${accountId}` : ''}`,
        { headers }
    );
    if (!campRes.ok) throw new Error(`Google campaigns fetch failed: ${campRes.status}`);
    const { results: campRows } = await campRes.json();

    // 2. Fetch analytics (last 7 days)
    const today = new Date().toISOString().split('T')[0];
    const week = new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0];
    const analyticsRes = await fetch(
        `${MOCK_API_BASE}/api/google-ads/analytics?startDate=${week}&endDate=${today}${accountId ? `&clientId=${accountId}` : ''}`,
        { headers }
    );
    if (!analyticsRes.ok) throw new Error(`Google analytics fetch failed: ${analyticsRes.status}`);
    const { results: analyticsRows } = await analyticsRes.json();

    // Group analytics by campaignId → date
    const metricsMap = {};
    for (const row of analyticsRows) {
        const key = `${row.campaign.id}__${row.segments.date}`;
        metricsMap[key] = {
            impressions: parseInt(row.metrics.impressions),
            clicks: parseInt(row.metrics.clicks),
            spend: parseFloat(row.metrics.costMicros) / 1_000_000,
            conversions: parseFloat(row.metrics.conversions),
            leads: null, reach: null, revenue: parseFloat(row.metrics.conversionsValue),
        };
    }

    // 3. Upsert to DB inside a transaction
    const db = await getClient();
    let records = 0;
    try {
        await db.query('BEGIN');
        for (const row of campRows) {
            const c = row.campaign;
            const dbStatus = c.status === 'ENABLED' ? 'active' : c.status === 'PAUSED' ? 'paused' : 'completed';
            const campaignId = await upsertCampaign(db, clientId, 'google_ads', c.id, c.name, dbStatus, null, c.startDate, c.endDate);

            for (const [key, m] of Object.entries(metricsMap)) {
                if (!key.startsWith(`${c.id}__`)) continue;
                const date = key.split('__')[1];
                await upsertMetric(db, campaignId, clientId, date, m, 'google_ads');
                records++;
            }
        }
        await db.query('COMMIT');
    } catch (err) {
        await db.query('ROLLBACK');
        throw err;
    } finally {
        db.release();
    }
    return records;
}

// ─────────────────────────────────────────────────────────────
// Meta Ads Sync
// ─────────────────────────────────────────────────────────────
async function runMetaSync(clientId) {
    const { accessToken, accountId } = await loadCredentials(clientId, 'meta_ads');
    const token = `access_token=${accessToken}`;

    // 1. Fetch campaigns
    const campRes = await fetch(
        `${MOCK_API_BASE}/api/meta-ads/campaigns?${token}${accountId ? `&clientId=${accountId}` : ''}`
    );
    if (!campRes.ok) throw new Error(`Meta campaigns fetch failed: ${campRes.status}`);
    const { data: campaigns } = await campRes.json();

    // 2. Fetch analytics
    const today = new Date().toISOString().split('T')[0];
    const week = new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0];
    const analyticsRes = await fetch(
        `${MOCK_API_BASE}/api/meta-ads/analytics?${token}&startDate=${week}&endDate=${today}${accountId ? `&clientId=${accountId}` : ''}`
    );
    if (!analyticsRes.ok) throw new Error(`Meta analytics fetch failed: ${analyticsRes.status}`);
    const { data: analyticsRows } = await analyticsRes.json();

    // Group analytics by campaignId → date
    const metricsMap = {};
    for (const row of analyticsRows) {
        const key = `${row.campaign_id}__${row.date_start}`;
        const leadAction = row.actions?.find(a => a.action_type === 'lead');
        metricsMap[key] = {
            impressions: parseInt(row.impressions),
            clicks: parseInt(row.clicks),
            spend: parseFloat(row.spend),
            reach: parseInt(row.reach),
            leads: leadAction ? parseInt(leadAction.value) : null,
            conversions: null, revenue: null,
        };
    }

    const db = await getClient();
    let records = 0;
    try {
        await db.query('BEGIN');
        for (const c of campaigns) {
            const dbStatus = c.status === 'ACTIVE' ? 'active' : c.status === 'PAUSED' ? 'paused' : 'completed';
            const budget = c.daily_budget ? parseInt(c.daily_budget) / 100 : null; // cents → dollars
            const campaignId = await upsertCampaign(db, clientId, 'meta_ads', c.id, c.name, dbStatus, budget,
                c.start_time?.split('T')[0], c.stop_time?.split('T')[0]);

            for (const [key, m] of Object.entries(metricsMap)) {
                if (!key.startsWith(`${c.id}__`)) continue;
                const date = key.split('__')[1];
                await upsertMetric(db, campaignId, clientId, date, m, 'meta_ads');
                records++;
            }
        }
        await db.query('COMMIT');
    } catch (err) {
        await db.query('ROLLBACK');
        throw err;
    } finally {
        db.release();
    }
    return records;
}

// ─────────────────────────────────────────────────────────────
// LinkedIn Ads Sync
// ─────────────────────────────────────────────────────────────
async function runLinkedInSync(clientId) {
    const { accessToken, accountId } = await loadCredentials(clientId, 'linkedin_ads');

    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'X-Restli-Protocol-Version': '2.0.0',
    };

    // 1. Fetch campaigns
    const campRes = await fetch(
        `${MOCK_API_BASE}/api/linkedin-ads/campaigns${accountId ? `?clientId=${encodeURIComponent(accountId)}` : ''}`,
        { headers }
    );
    if (!campRes.ok) throw new Error(`LinkedIn campaigns fetch failed: ${campRes.status}`);
    const { elements: campaigns } = await campRes.json();

    // 2. Fetch analytics
    const today = new Date().toISOString().split('T')[0];
    const week = new Date(Date.now() - 7 * 864e5).toISOString().split('T')[0];
    const analyticsRes = await fetch(
        `${MOCK_API_BASE}/api/linkedin-ads/analytics?startDate=${week}&endDate=${today}${accountId ? `&clientId=${encodeURIComponent(accountId)}` : ''}`,
        { headers }
    );
    if (!analyticsRes.ok) throw new Error(`LinkedIn analytics fetch failed: ${analyticsRes.status}`);
    const { elements: analyticsRows } = await analyticsRes.json();

    // Group analytics by campaignId → date
    const metricsMap = {};
    for (const row of analyticsRows) {
        const campId = row.pivotValues?.[0];
        const { year, month, day } = row.dateRange.start;
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const key = `${campId}__${date}`;
        metricsMap[key] = {
            impressions: parseInt(row.impressions),
            clicks: parseInt(row.clicks),
            spend: parseFloat(row.costInLocalCurrency),
            leads: parseInt(row.oneClickLeads),
            reach: null, conversions: null, revenue: null,
        };
    }

    const db = await getClient();
    let records = 0;
    try {
        await db.query('BEGIN');
        for (const c of campaigns) {
            const dbStatus = c.status === 'ACTIVE' ? 'active' : c.status === 'PAUSED' ? 'paused' : 'completed';
            const budget = c.dailyBudget?.amount ? parseFloat(c.dailyBudget.amount) : null;
            const startDate = c.startAt ? new Date(c.startAt).toISOString().split('T')[0] : null;
            const endDate = c.endAt ? new Date(c.endAt).toISOString().split('T')[0] : null;
            const campaignId = await upsertCampaign(db, clientId, 'linkedin_ads', c.id, c.name, dbStatus, budget, startDate, endDate);

            for (const [key, m] of Object.entries(metricsMap)) {
                if (!key.startsWith(`${c.id}__`)) continue;
                const date = key.split('__')[1];
                await upsertMetric(db, campaignId, clientId, date, m, 'linkedin_ads');
                records++;
            }
        }
        await db.query('COMMIT');
    } catch (err) {
        await db.query('ROLLBACK');
        throw err;
    } finally {
        db.release();
    }
    return records;
}

// ─────────────────────────────────────────────────────────────
// Twitter/X Ads Sync
// ─────────────────────────────────────────────────────────────
async function runTwitterSync(clientId) {
    const { accessToken, accountId } = await loadCredentials(clientId, 'twitter_ads');

    const oauthHeader = `OAuth oauth_consumer_key="mock_consumer_key", oauth_token="${accessToken}", oauth_signature_method="HMAC-SHA1", oauth_timestamp="${Math.floor(Date.now() / 1000)}", oauth_nonce="mock_nonce_${Date.now()}", oauth_version="1.0", oauth_signature="mock_signature"`;
    const headers = { 'Authorization': oauthHeader };

    // 1. Fetch campaigns
    const campRes = await fetch(
        `${MOCK_API_BASE}/api/twitter-ads/campaigns${accountId ? `?clientId=${accountId}` : ''}`,
        { headers }
    );
    if (!campRes.ok) throw new Error(`Twitter campaigns fetch failed: ${campRes.status}`);
    const { data: campaigns } = await campRes.json();

    // 2. Fetch analytics
    const analyticsRes = await fetch(
        `${MOCK_API_BASE}/api/twitter-ads/analytics${accountId ? `?clientId=${accountId}` : ''}`,
        { headers }
    );
    if (!analyticsRes.ok) throw new Error(`Twitter analytics fetch failed: ${analyticsRes.status}`);
    const { data: statsRows } = await analyticsRes.json();

    // Build metricsMap from Twitter's array-of-strings metric format
    const metricsMap = {};
    for (const row of statsRows) {
        const id = row.id;
        const idData = row.id_data?.[0];
        if (!idData) continue;
        const m = idData.metrics;
        // Each metric is a 7-element array (one per day), base day is today - 7 days
        const baseDate = new Date(Date.now() - 7 * 864e5);
        const len = m.impressions?.length ?? 0;
        for (let i = 0; i < len; i++) {
            const d = new Date(baseDate.getTime() + i * 864e5).toISOString().split('T')[0];
            const key = `${id}__${d}`;
            metricsMap[key] = {
                impressions: m.impressions?.[i] ? parseInt(m.impressions[i]) : null,
                clicks: m.clicks?.[i] ? parseInt(m.clicks[i]) : null,
                spend: m.spend?.[i] ? parseInt(m.spend[i]) / 1_000_000 : null,   // micros → dollars
                conversions: m.installs?.[i] ? parseInt(m.installs[i]) : null,
                leads: null, reach: null, revenue: null,
            };
        }
    }

    const db = await getClient();
    let records = 0;
    try {
        await db.query('BEGIN');
        for (const c of campaigns) {
            const dbStatus = c.entity_status === 'ACTIVE' ? 'active' : c.entity_status === 'PAUSED' ? 'paused' : 'completed';
            const budget = c.daily_budget_amount_local_micro ? c.daily_budget_amount_local_micro / 1_000_000 : null;
            const campaignId = await upsertCampaign(db, clientId, 'twitter_ads', c.id, c.name, dbStatus, budget,
                c.start_time?.split('T')[0], c.end_time?.split('T')[0]);

            for (const [key, m] of Object.entries(metricsMap)) {
                if (!key.startsWith(`${c.id}__`)) continue;
                const date = key.split('__')[1];
                await upsertMetric(db, campaignId, clientId, date, m, 'twitter_ads');
                records++;
            }
        }
        await db.query('COMMIT');
    } catch (err) {
        await db.query('ROLLBACK');
        throw err;
    } finally {
        db.release();
    }
    return records;
}

// ─────────────────────────────────────────────────────────────
// Platform runner (shared error handling + sync_log write)
// ─────────────────────────────────────────────────────────────
async function runSync(clientId, platform, runner) {
    try {
        const records = await runner(clientId);
        await writeSyncLog(clientId, platform, true, records, null);
        return { success: true, records, error: null };
    } catch (err) {
        console.error(`[sync:${platform}] clientId=${clientId}:`, err.message);
        await writeSyncLog(clientId, platform, false, 0, err.message);
        return { success: false, records: 0, error: err.message };
    }
}

// ─────────────────────────────────────────────────────────────
// Route handlers
// ─────────────────────────────────────────────────────────────

// POST /api/sync/:client_id/google
export async function syncGoogle(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.client_id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid client ID' });

    const result = await runSync(idParsed.data, 'google_ads', runGoogleSync);
    return res.json({ platform: 'google_ads', ...result });
}

// POST /api/sync/:client_id/meta
export async function syncMeta(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.client_id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid client ID' });

    const result = await runSync(idParsed.data, 'meta_ads', runMetaSync);
    return res.json({ platform: 'meta_ads', ...result });
}

// POST /api/sync/:client_id/linkedin
export async function syncLinkedIn(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.client_id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid client ID' });

    const result = await runSync(idParsed.data, 'linkedin_ads', runLinkedInSync);
    return res.json({ platform: 'linkedin_ads', ...result });
}

// POST /api/sync/:client_id/twitter
export async function syncTwitter(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.client_id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid client ID' });

    const result = await runSync(idParsed.data, 'twitter_ads', runTwitterSync);
    return res.json({ platform: 'twitter_ads', ...result });
}

// POST /api/sync/:client_id/mailchimp (kept for backward compat)
export async function syncMailchimp(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.client_id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid client ID' });

    // Mailchimp not in mock-api; keep placeholder for now
    await writeSyncLog(idParsed.data, 'mailchimp', false, 0, 'Mailchimp sync not yet implemented');
    return res.status(501).json({ platform: 'mailchimp', success: false, error: 'Mailchimp sync not yet implemented' });
}

// POST /api/sync/:client_id/all  — sync all configured platforms in parallel
export async function syncAll(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.client_id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid client ID' });

    const clientId = idParsed.data;
    const [google, meta, linkedin, twitter] = await Promise.all([
        runSync(clientId, 'google_ads', runGoogleSync),
        runSync(clientId, 'meta_ads', runMetaSync),
        runSync(clientId, 'linkedin_ads', runLinkedInSync),
        runSync(clientId, 'twitter_ads', runTwitterSync),
    ]);

    return res.json({
        google_ads: { platform: 'google_ads', ...google },
        meta_ads: { platform: 'meta_ads', ...meta },
        linkedin_ads: { platform: 'linkedin_ads', ...linkedin },
        twitter_ads: { platform: 'twitter_ads', ...twitter },
    });
}

// GET /api/sync/:client_id/logs
export async function getSyncLogs(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.client_id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid client ID' });

    const result = await query(
        `SELECT id, platform, status, records_synced, error_message, synced_at
         FROM sync_logs WHERE client_id = $1 ORDER BY synced_at DESC LIMIT 100`,
        [idParsed.data]
    );

    const lastSynced = await query(
        `SELECT MAX(synced_at) AS last_synced FROM sync_logs WHERE client_id = $1 AND status = 'success'`,
        [idParsed.data]
    );

    return res.json({
        logs: result.rows,
        last_synced: lastSynced.rows[0]?.last_synced || null,
    });
}

// GET /api/sync/all-logs
export async function getAllSyncLogs(req, res) {
    const role = req.user.role;
    
    let queryStr = `
        SELECT DISTINCT ON (c.name, sl.platform)
            sl.id, sl.platform, sl.status, sl.records_synced, sl.error_message, sl.synced_at, c.name as client_name, c.id as client_id
        FROM sync_logs sl
        JOIN clients c ON c.id = sl.client_id
    `;
    const params = [];

    if (role === 'admin') {
        // Full access, no where clause needed
    } else if (role === 'manager') {
        if (!req.assignedClientIds || req.assignedClientIds.length === 0) {
            return res.json({ logs: [] });
        }
        queryStr += ` WHERE c.id = ANY($1::uuid[])`;
        params.push(req.assignedClientIds);
    } else if (role === 'employee') {
        queryStr += ` 
            WHERE EXISTS (
                SELECT 1 FROM campaigns emp_c 
                JOIN employee_campaign_assignments emp_eca ON emp_eca.campaign_id = emp_c.id 
                WHERE emp_c.client_id = c.id 
                AND emp_c.platform::text = sl.platform::text 
                AND emp_eca.employee_id = $1
            )
        `;
        params.push(req.user.user_id);
    } else if (role === 'client') {
        queryStr += ` WHERE c.id = $1`;
        params.push(req.user.client_id);
    } else {
        return res.status(403).json({ error: 'Access denied' });
    }

    queryStr += ` ORDER BY c.name, sl.platform, sl.synced_at DESC`;

    const result = await query(queryStr, params);
    return res.json({ logs: result.rows });
}
