import { query } from '../services/db.js';

// ─── GET /api/dashboard/agency ──────────────────────────────
export async function agencyDashboard(req, res) {
    // If manager, scope to assigned clients only
    const assignedIds = req.assignedClientIds;
    let clientFilter = '';
    const params = [];

    if (assignedIds && assignedIds.length > 0) {
        const placeholders = assignedIds.map((_, i) => `$${i + 1}`).join(', ');
        clientFilter = ` AND c.id IN (${placeholders})`;
        params.push(...assignedIds);
    } else if (assignedIds && assignedIds.length === 0 && req.user.role !== 'admin') {
        // Manager/employee with no assignments
        return res.json({
            total_spend: 0, avg_roas: 0, active_clients: 0, total_campaigns: 0, last_synced: null,
        });
    }

    const result = await query(
        `SELECT
       COALESCE(SUM(cm.spend), 0)       AS total_spend,
       COUNT(DISTINCT c.id)             AS active_clients,
       COUNT(DISTINCT camp.id)          AS total_campaigns,
       MAX(cm.synced_at)                AS last_synced
     FROM clients c
     LEFT JOIN campaigns camp ON camp.client_id = c.id
     LEFT JOIN campaign_metrics cm ON cm.client_id = c.id
     WHERE c.is_active = true${clientFilter}`,
        params
    );

    const roasResult = await query(
        `SELECT
       CASE WHEN SUM(spend) > 0 THEN ROUND(SUM(revenue) / SUM(spend), 2) ELSE 0 END AS avg_roas
     FROM campaign_metrics cm
     JOIN clients c ON c.id = cm.client_id AND c.is_active = true${clientFilter}`,
        params
    );

    const row = result.rows[0];
    return res.json({
        total_spend: parseFloat(row.total_spend),
        avg_roas: parseFloat(roasResult.rows[0].avg_roas),
        active_clients: parseInt(row.active_clients),
        total_campaigns: parseInt(row.total_campaigns),
        last_synced: row.last_synced,
    });
}

// ─── GET /api/dashboard/client/:client_id ───────────────────
export async function clientDashboard(req, res) {
    const requestedClientId = req.params.client_id;

    // Enforce scoping at the controller level (req.params not visible to scopeGuard)
    if (req.user.role === 'client') {
        if (requestedClientId && requestedClientId !== req.user.client_id) {
            return res.status(403).json({ error: 'Access denied' });
        }
    }
    if (req.user.role === 'manager') {
        const assignedIds = req.assignedClientIds || [];
        if (requestedClientId && !assignedIds.includes(requestedClientId)) {
            return res.status(403).json({ error: 'Access denied — client not assigned to you' });
        }
    }
    if (req.user.role === 'employee') {
        const assignedIds = req.assignedClientIds || [];
        if (requestedClientId && !assignedIds.includes(requestedClientId)) {
            return res.status(403).json({ error: 'Access denied — client not assigned to you' });
        }
    }

    const clientId = req.user.role === 'client' ? req.user.client_id : requestedClientId;
    if (!clientId) return res.status(400).json({ error: 'Client ID required' });

    // Current period: last 30 days
    const now = new Date();
    const currentFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const currentTo = now.toISOString().split('T')[0];
    const prevFrom = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const prevTo = currentFrom;

    const current = await query(
        `SELECT COALESCE(SUM(spend),0) AS spend, COALESCE(SUM(leads),0) AS leads,
            COALESCE(SUM(reach),0) AS reach
     FROM campaign_metrics WHERE client_id = $1 AND date >= $2 AND date <= $3`,
        [clientId, currentFrom, currentTo]
    );

    const previous = await query(
        `SELECT COALESCE(SUM(spend),0) AS spend, COALESCE(SUM(leads),0) AS leads,
            COALESCE(SUM(reach),0) AS reach
     FROM campaign_metrics WHERE client_id = $1 AND date >= $2 AND date <= $3`,
        [clientId, prevFrom, prevTo]
    );

    const c = current.rows[0];
    const p = previous.rows[0];

    function pctChange(curr, prev) {
        if (parseFloat(prev) === 0) return curr > 0 ? 100 : 0;
        return Math.round(((parseFloat(curr) - parseFloat(prev)) / parseFloat(prev)) * 100);
    }

    const totalSpend = parseFloat(c.spend);
    const totalLeads = parseInt(c.leads);
    const cpl = totalLeads > 0 ? totalSpend / totalLeads : 0;

    const prevSpend = parseFloat(p.spend);
    const prevLeads = parseInt(p.leads);
    const prevCpl = prevLeads > 0 ? prevSpend / prevLeads : 0;

    return res.json({
        money_spent: { value: totalSpend, change_pct: pctChange(c.spend, p.spend) },
        leads: { value: totalLeads, change_pct: pctChange(c.leads, p.leads) },
        reach: { value: parseInt(c.reach), change_pct: pctChange(c.reach, p.reach) },
        cost_per_lead: { value: Math.round(cpl * 100) / 100, change_pct: pctChange(cpl, prevCpl) },
    });
}

// ─── GET /api/dashboard/employee ────────────────────────────
// Aggregated metrics across all of the employee's assigned clients
export async function employeeDashboard(req, res) {
    const assignedIds = req.assignedClientIds || [];
    if (assignedIds.length === 0) {
        return res.json({
            total_spend: 0,
            assigned_clients: 0,
            total_campaigns: 0,
            last_synced: null,
        });
    }

    const placeholders = assignedIds.map((_, i) => `$${i + 1}`).join(', ');

    const result = await query(
        `SELECT
           COALESCE(SUM(cm.spend), 0)   AS total_spend,
           COUNT(DISTINCT c.id)         AS assigned_clients,
           COUNT(DISTINCT camp.id)      AS total_campaigns,
           MAX(cm.synced_at)            AS last_synced
         FROM clients c
         LEFT JOIN campaigns camp ON camp.client_id = c.id
         LEFT JOIN campaign_metrics cm ON cm.client_id = c.id
         WHERE c.is_active = true AND c.id IN (${placeholders})`,
        assignedIds
    );

    const row = result.rows[0];
    return res.json({
        total_spend: parseFloat(row.total_spend),
        assigned_clients: parseInt(row.assigned_clients),
        total_campaigns: parseInt(row.total_campaigns),
        last_synced: row.last_synced,
    });
}

