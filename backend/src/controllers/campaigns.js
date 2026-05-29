import { query } from '../services/db.js';
import { createCampaignSchema, updateCampaignSchema, campaignQuerySchema } from '../validators/campaigns.js';
import { uuidParamSchema } from '../validators/clients.js';

function managerHasClient(req, clientId) {
    return (req.assignedClientIds || []).includes(clientId);
}

async function employeeHasCampaign(req, campaignId) {
    const result = await query(
        `SELECT 1 FROM employee_campaign_assignments WHERE campaign_id = $1 AND employee_id = $2`,
        [campaignId, req.user.user_id]
    );
    return result.rows.length > 0;
}

async function canAccessCampaign(req, campaign) {
    if (req.user.role === 'client') {
        return campaign.client_id === req.user.client_id;
    }

    if (req.user.role === 'manager') {
        return managerHasClient(req, campaign.client_id);
    }

    if (req.user.role === 'employee') {
        return employeeHasCampaign(req, campaign.id);
    }

    return true;
}

function validateEmployeeFilter(req, res) {
    if (req.user.role !== 'employee') return true;

    const requestedEmployeeId = req.query?.employee_id || req.body?.employee_id;
    if (!requestedEmployeeId) {
        res.status(400).json({ error: 'employee_id is required' });
        return false;
    }

    if (requestedEmployeeId !== req.user.user_id) {
        res.status(403).json({ error: 'Access denied' });
        return false;
    }

    return true;
}

async function loadCampaignForAccess(campaignId) {
    const result = await query(
        `SELECT id, client_id FROM campaigns WHERE id = $1`,
        [campaignId]
    );
    return result.rows[0] || null;
}

// ─── GET /api/campaigns ─────────────────────────────────────
export async function listCampaigns(req, res) {
    const parsed = campaignQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid query parameters' });
    if (!validateEmployeeFilter(req, res)) return;

    const clientId = req.scopedClientId || parsed.data.client_id;
    const conditions = ['c.client_id IS NOT NULL'];
    const values = [];
    let i = 1;

    if (clientId) {
        conditions.push(`c.client_id = $${i}`);
        values.push(clientId);
        i++;
    }
    
    if (req.user.role === 'manager') {
        if (!req.assignedClientIds || req.assignedClientIds.length === 0) {
            return res.json({ campaigns: [] });
        }
        if (!clientId) {
            conditions.push(`c.client_id = ANY($${i}::uuid[])`);
            values.push(req.assignedClientIds);
            i++;
        }
    } else if (req.user.role === 'employee') {
        conditions.push(`EXISTS (SELECT 1 FROM employee_campaign_assignments eca_filter WHERE eca_filter.campaign_id = c.id AND eca_filter.employee_id = $${i})`);
        values.push(req.user.user_id);
        i++;
    }
    if (parsed.data.platform) {
        conditions.push(`c.platform = $${i}`);
        values.push(parsed.data.platform);
        i++;
    }
    if (parsed.data.status) {
        conditions.push(`c.status = $${i}`);
        values.push(parsed.data.status);
        i++;
    }
    if (parsed.data.from) {
        conditions.push(`c.start_date >= $${i}`);
        values.push(parsed.data.from);
        i++;
    }
    if (parsed.data.to) {
        conditions.push(`c.end_date <= $${i}`);
        values.push(parsed.data.to);
        i++;
    }

    // Pre-aggregate metrics in a CTE to prevent the Cartesian product that
    // occurs when both campaign_metrics (1-to-many) and
    // employee_campaign_assignments (1-to-many) are joined in the same query.
    // Without the CTE, each metric row would be duplicated once per assigned
    // employee, causing SUM(spend) etc. to be multiplied by employee count.
    const totalsSelect = `COALESCE(agg.total_spend,   0) AS total_spend,
               COALESCE(agg.total_leads,   0) AS total_leads,
               COALESCE(agg.total_clicks,  0) AS total_clicks,
               COALESCE(agg.total_impressions, 0) AS total_impressions,
               COALESCE(agg.total_reach, 0) AS total_reach,
               COALESCE(agg.total_conversions, 0) AS total_conversions,
               COALESCE(agg.total_revenue, 0) AS total_revenue`;

    const employeeSelect = req.user.role === 'employee'
        ? `cl.industry AS client_industry,
               COALESCE(agg.total_leads,   0) AS total_leads,
               COALESCE(agg.total_clicks,  0) AS total_clicks,
               COALESCE(agg.total_impressions, 0) AS total_impressions,
               COALESCE(agg.total_reach, 0) AS total_reach,
               COALESCE(agg.total_conversions, 0) AS total_conversions`
        : req.user.role === 'client'
        ? totalsSelect
        : `COALESCE((
                   SELECT JSON_AGG(JSON_BUILD_OBJECT('id', u.id, 'name', u.name))
                   FROM employee_campaign_assignments eca
                   JOIN users u ON u.id = eca.employee_id
                   WHERE eca.campaign_id = c.id
               ), '[]') AS assigned_employees,
               ${totalsSelect}`;

    const result = await query(
        `WITH agg AS (
            SELECT campaign_id,
                   COALESCE(SUM(spend),   0) AS total_spend,
                   COALESCE(SUM(leads),   0) AS total_leads,
                   COALESCE(SUM(clicks),  0) AS total_clicks,
                   COALESCE(SUM(impressions), 0) AS total_impressions,
                   COALESCE(SUM(reach), 0) AS total_reach,
                   COALESCE(SUM(conversions), 0) AS total_conversions,
                   COALESCE(SUM(revenue), 0) AS total_revenue
            FROM campaign_metrics
            GROUP BY campaign_id
        )
        SELECT c.id, c.client_id, c.name, c.platform, c.external_id, c.status,
               ${req.user.role === 'admin' || req.user.role === 'manager' ? 'c.budget,' : ''} c.start_date, c.end_date, c.created_at,
               cl.name AS client_name,
               ${employeeSelect}
        FROM campaigns c
        JOIN clients cl ON cl.id = c.client_id AND cl.is_active = true
        LEFT JOIN agg ON agg.campaign_id = c.id
        WHERE ${conditions.join(' AND ')}
        ORDER BY c.created_at DESC`,
        values
    );

    return res.json({ campaigns: result.rows });
}

// ─── GET /api/campaigns/:id ─────────────────────────────────
export async function getCampaign(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid campaign ID' });
    if (!validateEmployeeFilter(req, res)) return;

    const campaignSql = req.user.role === 'employee' || req.user.role === 'client'
        ? `SELECT c.id, c.client_id, c.name, c.platform, c.status, c.start_date, c.end_date,
            cl.name AS client_name${req.user.role === 'employee' ? ', cl.industry AS client_industry' : ''}
     FROM campaigns c
     JOIN clients cl ON cl.id = c.client_id
     WHERE c.id = $1`
        : `SELECT c.*, cl.name AS client_name,
            COALESCE(JSON_AGG(JSON_BUILD_OBJECT('id', u.id, 'name', u.name)) FILTER (WHERE u.id IS NOT NULL), '[]') AS assigned_employees
     FROM campaigns c
     JOIN clients cl ON cl.id = c.client_id
     LEFT JOIN employee_campaign_assignments eca ON eca.campaign_id = c.id
     LEFT JOIN users u ON u.id = eca.employee_id
     WHERE c.id = $1
     GROUP BY c.id, cl.name`;

    const result = await query(
        campaignSql,
        [idParsed.data]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

    const campaign = result.rows[0];

    // Enforce campaign client scoping for all scoped roles.
    if (!(await canAccessCampaign(req, campaign))) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const metricSql = req.user.role === 'employee'
        ? `SELECT date,
            impressions,
            clicks,
            leads,
            reach,
            conversions,
            source,
            synced_at,
            CASE WHEN impressions > 0 THEN ROUND(clicks::numeric * 100 / impressions, 2) ELSE 0 END AS ctr,
            CASE WHEN clicks > 0 THEN ROUND(spend::numeric / clicks, 2) ELSE 0 END AS cpc,
            CASE WHEN impressions > 0 THEN ROUND(spend::numeric * 1000 / impressions, 2) ELSE 0 END AS cpm
     FROM campaign_metrics WHERE campaign_id = $1 ORDER BY date DESC`
        : `SELECT date, spend, impressions, clicks, leads, reach, conversions, revenue, source, synced_at
     FROM campaign_metrics WHERE campaign_id = $1 ORDER BY date DESC`;

    const metrics = await query(
        metricSql,
        [idParsed.data]
    );

    return res.json({ campaign, metrics: metrics.rows });
}

// ─── POST /api/campaigns ────────────────────────────────────
export async function createCampaign(req, res) {
    const parsed = createCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    const { client_id, name, platform, external_id, status, budget, start_date, end_date } = parsed.data;

    // Verify client exists
    const clientCheck = await query(`SELECT id FROM clients WHERE id = $1 AND is_active = true`, [client_id]);
    if (clientCheck.rows.length === 0) return res.status(404).json({ error: 'Client not found' });
    if (req.user.role === 'manager' && !managerHasClient(req, client_id)) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(
        `INSERT INTO campaigns (client_id, name, platform, external_id, status, budget, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [client_id, name, platform, external_id || null, status, budget || null, start_date || null, end_date || null]
    );

    const campaign = result.rows[0];
    campaign.assigned_employees = [];

    return res.status(201).json({ campaign });
}

// ─── PATCH /api/campaigns/:id ───────────────────────────────
export async function updateCampaign(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid campaign ID' });

    const parsed = updateCampaignSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    const existingCampaign = await loadCampaignForAccess(idParsed.data);
    if (!existingCampaign) return res.status(404).json({ error: 'Campaign not found' });
    if (!(await canAccessCampaign(req, existingCampaign))) {
        return res.status(403).json({ error: 'Access denied' });
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
        `UPDATE campaigns SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
        values
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    
    // Fetch current assignments for this campaign to return to frontend
    const assignments = await query(
        `SELECT u.id, u.name 
         FROM users u
         JOIN employee_campaign_assignments eca ON eca.employee_id = u.id
         WHERE eca.campaign_id = $1`,
        [idParsed.data]
    );

    const campaign = result.rows[0];
    campaign.assigned_employees = assignments.rows;

    return res.json({ campaign });
}

// ─── DELETE /api/campaigns/:id ──────────────────────────────
export async function deleteCampaign(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid campaign ID' });

    const existingCampaign = await loadCampaignForAccess(idParsed.data);
    if (!existingCampaign) return res.status(404).json({ error: 'Campaign not found' });
    if (!(await canAccessCampaign(req, existingCampaign))) {
        return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(
        `DELETE FROM campaigns WHERE id = $1 RETURNING id`,
        [idParsed.data]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    return res.json({ message: 'Campaign deleted successfully' });
}

// ─── POST /api/campaigns/:id/employees ──────────────────────
export async function setCampaignEmployees(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid campaign ID' });

    const { employee_ids } = req.body;
    if (!Array.isArray(employee_ids)) {
        return res.status(400).json({ error: 'employee_ids must be an array of UUID strings' });
    }

    // Verify campaign exists and is within the caller's scope.
    const campaign = await loadCampaignForAccess(idParsed.data);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
    if (!(await canAccessCampaign(req, campaign))) {
        return res.status(403).json({ error: 'Access denied' });
    }

    // Begin a local query transaction to update assignments atomicly
    await query('BEGIN');
    try {
        // Delete existing assignments
        await query(`DELETE FROM employee_campaign_assignments WHERE campaign_id = $1`, [idParsed.data]);

        // Insert new ones
        for (const empId of employee_ids) {
            // Verify employee is actually an active employee
            const empCheck = await query(`SELECT id, role FROM users WHERE id = $1 AND role = 'employee' AND is_active = true`, [empId]);
            if (empCheck.rows.length > 0) {
                await query(
                    `INSERT INTO employee_campaign_assignments (employee_id, campaign_id) 
                     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                    [empId, idParsed.data]
                );
            }
        }
        await query('COMMIT');

        // Fetch and return the updated employees list
        const updated = await query(
            `SELECT u.id, u.name 
             FROM users u
             JOIN employee_campaign_assignments eca ON eca.employee_id = u.id
             WHERE eca.campaign_id = $1`,
            [idParsed.data]
        );

        return res.json({ 
            message: 'Campaign employee assignments updated successfully', 
            assigned_employees: updated.rows 
        });
    } catch (err) {
        await query('ROLLBACK');
        console.error('Failed to assign campaign employees:', err);
        return res.status(500).json({ error: 'Failed to update campaign employee assignments' });
    }
}
