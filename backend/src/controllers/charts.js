import { query } from '../services/db.js';
import { chartQuerySchema } from '../validators/metrics.js';

// ─── GET /api/charts/performance ────────────────────────────
export async function performanceChart(req, res) {
    const parsed = chartQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid query parameters' });

    const clientId = req.scopedClientId || parsed.data.client_id;
    if (!clientId) return res.status(400).json({ error: 'client_id is required' });

    const from = parsed.data.from || '1970-01-01';
    const to = parsed.data.to || '2099-12-31';

    const result = await query(
        `SELECT date,
            COALESCE(SUM(spend), 0)  AS spend,
            COALESCE(SUM(leads), 0)  AS leads,
            COALESCE(SUM(reach), 0)  AS reach
     FROM campaign_metrics
     WHERE client_id = $1 AND date >= $2 AND date <= $3
     GROUP BY date ORDER BY date`,
        [clientId, from, to]
    );

    return res.json({ data: result.rows });
}

// ─── GET /api/charts/platform-split ─────────────────────────
export async function platformSplit(req, res) {
    const parsed = chartQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid query parameters' });

    const clientId = req.scopedClientId || parsed.data.client_id;
    if (!clientId) return res.status(400).json({ error: 'client_id is required' });

    const from = parsed.data.from || '1970-01-01';
    const to = parsed.data.to || '2099-12-31';

    const result = await query(
        `SELECT source AS platform,
            COALESCE(SUM(spend), 0) AS spend
     FROM campaign_metrics
     WHERE client_id = $1 AND date >= $2 AND date <= $3
     GROUP BY source ORDER BY spend DESC`,
        [clientId, from, to]
    );

    return res.json({ data: result.rows });
}

// ─── GET /api/charts/agency-spend ───────────────────────────
export async function agencySpend(req, res) {
    const from = req.query.from || '1970-01-01';
    const to = req.query.to || '2099-12-31';

    let sql = `
        SELECT source AS platform,
            COALESCE(SUM(spend), 0) AS spend
        FROM campaign_metrics cm
        JOIN clients c ON c.id = cm.client_id AND c.is_active = true
        WHERE cm.date >= $1 AND cm.date <= $2
    `;
    const params = [from, to];
    let i = 3;

    if (req.user.role === 'manager' || req.user.role === 'employee') {
        if (!req.assignedClientIds || req.assignedClientIds.length === 0) {
            return res.json({ data: [] });
        }
        sql += ` AND cm.client_id = ANY($${i}::uuid[])`;
        params.push(req.assignedClientIds);
    } else if (req.user.role === 'client') {
        sql += ` AND cm.client_id = $${i}`;
        params.push(req.user.client_id);
    }

    sql += ` GROUP BY source ORDER BY spend DESC`;

    const result = await query(sql, params);

    return res.json({ data: result.rows });
}
