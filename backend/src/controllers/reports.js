import { generateClientReport } from '../services/pdf.js';
import { query } from '../services/db.js';
import { uuidParamSchema } from '../validators/clients.js';

// ─── GET /api/reports/pdf/:client_id ────────────────────────
export async function getPdfReport(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.client_id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid client ID' });

    // scopeGuard has already set req.scopedClientId for client role
    const clientId = req.scopedClientId || idParsed.data;

    // Enforce client scoping
    if (req.user.role === 'client' && clientId !== req.user.client_id) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const from = req.query.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const to = req.query.to || new Date().toISOString().split('T')[0];

    try {
        await generateClientReport(clientId, from, to, res);
    } catch (err) {
        if (!res.headersSent) {
            return res.status(500).json({ error: 'Failed to generate report' });
        }
    }
}

// ─── GET /api/reports/analytics ──────────────────────────────
export async function getAnalyticsReport(req, res) {
    const clientId = req.scopedClientId || req.query.client_id;
    if (req.user.role === 'client' && clientId !== req.user.client_id) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const from = req.query.from || '1970-01-01';
    const to = req.query.to || '2099-12-31';

    try {
        let sql = `
            SELECT 
                cm.source AS platform,
                c.name AS campaign_name,
                c.status,
                SUM(cm.spend) AS total_spend,
                SUM(cm.impressions) AS total_impressions,
                SUM(cm.clicks) AS total_clicks,
                SUM(cm.leads) AS total_leads
            FROM campaign_metrics cm
            JOIN campaigns c ON cm.campaign_id = c.id
            WHERE cm.date >= $1 AND cm.date <= $2
        `;
        const params = [from, to];

        if (clientId) {
            sql += ` AND cm.client_id = $3`;
            params.push(clientId);
        } else if (req.user.role === 'manager') {
            sql += ` AND cm.client_id IN (SELECT client_id FROM manager_client_assignments WHERE manager_id = $3)`;
            params.push(req.user.user_id);
        } else if (req.user.role === 'employee') {
            sql += ` AND cm.client_id IN (
                SELECT DISTINCT c.client_id 
                FROM campaigns c
                JOIN employee_campaign_assignments eca ON eca.campaign_id = c.id
                WHERE eca.employee_id = $3
            )`;
            params.push(req.user.user_id);
        }

        sql += ` GROUP BY cm.source, c.name, c.status ORDER BY total_spend DESC`;

        const result = await query(sql, params);
        
        // Compute calculated metrics
        const data = result.rows.map(row => ({
            ...row,
            ctr: row.total_impressions > 0 ? ((row.total_clicks / row.total_impressions) * 100).toFixed(2) + '%' : '0%',
            cpl: row.total_leads > 0 ? (row.total_spend / row.total_leads).toFixed(2) : '0',
            cpc: row.total_clicks > 0 ? (row.total_spend / row.total_clicks).toFixed(2) : '0',
        }));

        res.json({ data });
    } catch (err) {
        console.error("Analytics report error:", err);
        res.status(500).json({ error: 'Failed to generate analytics report' });
    }
}
