import { query, getClient as getDbClient } from '../services/db.js';
import { uuidParamSchema } from '../validators/clients.js';
import { createDealSchema, updateDealSchema } from '../validators/kanban.js';

const STAGE_LABELS = {
    backlog: 'Backlog',
    qualified: 'Qualified',
    proposal: 'Proposal',
    negotiation: 'Negotiation',
    closedWon: 'Closed Won',
    closedLost: 'Closed Lost',
};

function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function dateOnly(value) {
    if (!value) return null;
    if (typeof value === 'string') return value.slice(0, 10);
    return value.toISOString().slice(0, 10);
}

function normalizeDeal(row) {
    return {
        id: row.id,
        clientId: row.client_id,
        campaignId: row.campaign_id,
        ownerId: row.owner_id,
        title: row.title,
        company: row.client_name,
        segment: row.client_segment || 'Pipeline',
        campaignName: row.campaign_name || '',
        owner: row.owner_name || 'Unassigned',
        priority: row.priority,
        value: toNumber(row.deal_value),
        dueDate: dateOnly(row.due_date),
        tags: row.tags || [],
        stage: row.stage,
        contactName: row.contact_name || 'Primary contact',
        contactEmail: row.contact_email || '',
        probability: Number(row.probability) || 0,
        lastActivityDate: dateOnly(row.last_activity_at),
        lastActivityNote: row.last_activity_note,
        notes: row.notes || '',
        blocker: row.blocker || undefined,
        activityLog: (row.activity_log || []).map((entry) => ({
            id: entry.id,
            at: entry.at,
            actor: entry.actor,
            text: entry.text,
        })),
    };
}

function dealSelectSql(whereSql) {
    return `
        SELECT kd.*,
               c.name AS client_name,
               c.industry AS client_segment,
               camp.name AS campaign_name,
               u.name AS owner_name,
               u.email AS owner_email,
               activity.activity_log
        FROM kanban_deals kd
        JOIN clients c ON c.id = kd.client_id AND c.is_active = true
        LEFT JOIN campaigns camp ON camp.id = kd.campaign_id
        LEFT JOIN users u ON u.id = kd.owner_id
        LEFT JOIN LATERAL (
            SELECT COALESCE(
                JSON_AGG(
                    JSON_BUILD_OBJECT(
                        'id', recent.id,
                        'at', recent.created_at,
                        'actor', recent.actor_name,
                        'text', recent.entry
                    )
                    ORDER BY recent.created_at DESC
                ),
                '[]'::json
            ) AS activity_log
            FROM (
                SELECT id, created_at, actor_name, entry
                FROM kanban_activity
                WHERE deal_id = kd.id
                ORDER BY created_at DESC
                LIMIT 5
            ) recent
        ) activity ON true
        ${whereSql}
    `;
}

function scopedClientCondition(req, values, alias = 'kd') {
    if (req.user.role === 'admin') return null;
    if (req.user.role === 'manager') {
        const assignedClientIds = req.assignedClientIds || [];
        if (assignedClientIds.length === 0) return 'FALSE';
        values.push(assignedClientIds);
        return `${alias}.client_id = ANY($${values.length}::uuid[])`;
    }
    return 'FALSE';
}

async function getCurrentActor(req, db = { query }) {
    const result = await db.query(
        `SELECT name, email FROM users WHERE id = $1`,
        [req.user.user_id]
    );
    const user = result.rows[0];
    return user?.name || user?.email || 'User';
}

async function getAccessibleDeal(req, dealId, db = { query }) {
    const values = [dealId];
    const conditions = ['kd.id = $1'];
    const scoped = scopedClientCondition(req, values);
    if (scoped) conditions.push(scoped);

    const result = await db.query(
        `${dealSelectSql(`WHERE ${conditions.join(' AND ')}`)}
         LIMIT 1`,
        values
    );

    return result.rows[0] || null;
}

async function pickDefaultClient(req, db = { query }) {
    const values = [];
    const conditions = ['c.is_active = true'];
    if (req.user.role === 'manager') {
        const assignedClientIds = req.assignedClientIds || [];
        if (assignedClientIds.length === 0) return null;
        values.push(assignedClientIds);
        conditions.push(`c.id = ANY($${values.length}::uuid[])`);
    }

    const result = await db.query(
        `SELECT c.id, c.name, c.industry, c.monthly_budget,
                contact.name AS contact_name,
                contact.email AS contact_email
         FROM clients c
         LEFT JOIN LATERAL (
            SELECT name, email
            FROM users
            WHERE client_id = c.id AND role = 'client' AND is_active = true
            ORDER BY created_at ASC
            LIMIT 1
         ) contact ON true
         WHERE ${conditions.join(' AND ')}
         ORDER BY c.created_at DESC
         LIMIT 1`,
        values
    );

    return result.rows[0] || null;
}

async function loadClientForCreate(req, clientId, db = { query }) {
    if (!clientId) return pickDefaultClient(req, db);

    const values = [clientId];
    const conditions = ['c.id = $1', 'c.is_active = true'];
    if (req.user.role === 'manager') {
        const assignedClientIds = req.assignedClientIds || [];
        if (!assignedClientIds.includes(clientId)) return null;
    }

    const result = await db.query(
        `SELECT c.id, c.name, c.industry, c.monthly_budget,
                contact.name AS contact_name,
                contact.email AS contact_email
         FROM clients c
         LEFT JOIN LATERAL (
            SELECT name, email
            FROM users
            WHERE client_id = c.id AND role = 'client' AND is_active = true
            ORDER BY created_at ASC
            LIMIT 1
         ) contact ON true
         WHERE ${conditions.join(' AND ')}
         LIMIT 1`,
        values
    );

    return result.rows[0] || null;
}

async function loadCampaignForCreate(req, campaignId, db = { query }) {
    if (!campaignId) return null;

    const values = [campaignId];
    const conditions = ['camp.id = $1', 'c.is_active = true'];
    const scoped = scopedClientCondition(req, values, 'camp');
    if (scoped) conditions.push(scoped);

    const result = await db.query(
        `SELECT camp.id, camp.client_id, camp.name, camp.budget, camp.status,
                c.name AS client_name,
                c.industry,
                c.monthly_budget,
                contact.name AS contact_name,
                contact.email AS contact_email
         FROM campaigns camp
         JOIN clients c ON c.id = camp.client_id
         LEFT JOIN LATERAL (
            SELECT name, email
            FROM users
            WHERE client_id = c.id AND role = 'client' AND is_active = true
            ORDER BY created_at ASC
            LIMIT 1
         ) contact ON true
         WHERE ${conditions.join(' AND ')}
         LIMIT 1`,
        values
    );

    return result.rows[0] || null;
}

async function validateOwner(req, ownerId, db = { query }) {
    if (!ownerId) return true;

    const values = [ownerId];
    const conditions = [`id = $1`, `is_active = true`, `role IN ('agency_admin', 'manager', 'employee')`];
    if (req.user.role === 'manager') {
        conditions.push(`(id = $2 OR manager_id = $2)`);
        values.push(req.user.user_id);
    }

    const result = await db.query(
        `SELECT id FROM users WHERE ${conditions.join(' AND ')} LIMIT 1`,
        values
    );

    return result.rows.length > 0;
}

async function getDealResponse(req, dealId, db = { query }) {
    const row = await getAccessibleDeal(req, dealId, db);
    return row ? normalizeDeal(row) : null;
}

async function listOwners(req) {
    const values = [];
    const conditions = [`is_active = true`, `role IN ('agency_admin', 'manager', 'employee')`];
    if (req.user.role === 'manager') {
        values.push(req.user.user_id);
        conditions.push(`(id = $1 OR manager_id = $1)`);
    }

    const result = await query(
        `SELECT id, name, email
         FROM users
         WHERE ${conditions.join(' AND ')}
         ORDER BY name ASC, email ASC`,
        values
    );

    return result.rows.map((owner) => ({
        id: owner.id,
        name: owner.name || owner.email,
        email: owner.email,
    }));
}

async function listClientsForUser(req) {
    const values = [];
    const conditions = ['c.is_active = true'];
    if (req.user.role === 'manager') {
        const assignedClientIds = req.assignedClientIds || [];
        if (assignedClientIds.length === 0) return [];
        values.push(assignedClientIds);
        conditions.push(`c.id = ANY($1::uuid[])`);
    }

    const result = await query(
        `SELECT c.id, c.name, c.industry AS segment
         FROM clients c
         WHERE ${conditions.join(' AND ')}
         ORDER BY c.name ASC`,
        values
    );

    return result.rows;
}

async function listCampaignsForUser(req) {
    const values = [];
    const conditions = ['c.is_active = true'];
    if (req.user.role === 'manager') {
        const assignedClientIds = req.assignedClientIds || [];
        if (assignedClientIds.length === 0) return [];
        values.push(assignedClientIds);
        conditions.push(`camp.client_id = ANY($1::uuid[])`);
    }

    const result = await query(
        `SELECT camp.id,
                camp.name,
                camp.client_id,
                c.name AS client_name,
                camp.status,
                camp.budget
         FROM campaigns camp
         JOIN clients c ON c.id = camp.client_id
         WHERE ${conditions.join(' AND ')}
         ORDER BY c.name ASC, camp.created_at DESC`,
        values
    );

    return result.rows;
}

export async function listDeals(req, res) {
    const values = [];
    const conditions = ['kd.is_archived = false'];
    const scoped = scopedClientCondition(req, values);
    if (scoped) conditions.push(scoped);

    const result = await query(
        `${dealSelectSql(`WHERE ${conditions.join(' AND ')}`)}
         ORDER BY
            CASE kd.stage
                WHEN 'backlog' THEN 1
                WHEN 'qualified' THEN 2
                WHEN 'proposal' THEN 3
                WHEN 'negotiation' THEN 4
                WHEN 'closedWon' THEN 5
                WHEN 'closedLost' THEN 6
                ELSE 7
            END,
            kd.updated_at DESC
         LIMIT 300`,
        values
    );

    const [owners, clients, campaigns] = await Promise.all([listOwners(req), listClientsForUser(req), listCampaignsForUser(req)]);

    return res.json({
        deals: result.rows.map(normalizeDeal),
        owners,
        clients,
        campaigns,
    });
}

export async function createDeal(req, res) {
    const parsed = createDealSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    const db = await getDbClient();
    try {
        await db.query('BEGIN');
        const actorName = await getCurrentActor(req, db);
        const campaign = await loadCampaignForCreate(req, parsed.data.campaign_id, db);
        const client = campaign
            ? {
                id: campaign.client_id,
                name: campaign.client_name,
                industry: campaign.industry,
                monthly_budget: campaign.monthly_budget,
                contact_name: campaign.contact_name,
                contact_email: campaign.contact_email,
            }
            : await loadClientForCreate(req, parsed.data.client_id, db);
        if (!client) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'No accessible client is available for this deal' });
        }

        const ownerId = parsed.data.owner_id === undefined ? req.user.user_id : parsed.data.owner_id;
        if (!(await validateOwner(req, ownerId, db))) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Invalid owner for this deal' });
        }

        const result = await db.query(
            `INSERT INTO kanban_deals (
                client_id, campaign_id, owner_id, title, priority, deal_value, due_date, tags, stage,
                contact_name, contact_email, probability, last_activity_note, notes, blocker, created_by
             )
             VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE + 14), $8, $9, $10, $11, $12, $13, $14, $15, $16)
             RETURNING id`,
            [
                client.id,
                campaign?.id || null,
                ownerId,
                parsed.data.title || (campaign ? `${client.name} ${campaign.name}` : `${client.name} opportunity`),
                parsed.data.priority || 'Medium',
                parsed.data.deal_value ?? toNumber(campaign?.budget || client.monthly_budget) * 3,
                parsed.data.due_date || null,
                parsed.data.tags || [client.segment || client.industry || 'New Business'],
                parsed.data.stage || 'backlog',
                parsed.data.contact_name || client.contact_name || 'Primary contact',
                parsed.data.contact_email || client.contact_email || null,
                parsed.data.probability ?? 15,
                'Deal created.',
                parsed.data.notes || '',
                parsed.data.blocker || null,
                req.user.user_id,
            ]
        );

        const dealId = result.rows[0].id;
        await db.query(
            `INSERT INTO kanban_activity (deal_id, actor_id, actor_name, entry)
             VALUES ($1, $2, $3, $4)`,
            [dealId, req.user.user_id, actorName, `Deal created in ${STAGE_LABELS[parsed.data.stage || 'backlog']}.`]
        );
        await db.query('COMMIT');

        const deal = await getDealResponse(req, dealId);
        return res.status(201).json({ deal });
    } catch (err) {
        await db.query('ROLLBACK');
        throw err;
    } finally {
        db.release();
    }
}

export async function updateDeal(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid deal ID' });

    const parsed = updateDealSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors });
    }

    if (Object.keys(parsed.data).length === 0) return res.status(400).json({ error: 'No fields to update' });

    const db = await getDbClient();
    try {
        await db.query('BEGIN');
        const existing = await getAccessibleDeal(req, idParsed.data, db);
        if (!existing) {
            await db.query('ROLLBACK');
            return res.status(404).json({ error: 'Deal not found' });
        }

        if (parsed.data.client_id) {
            const nextClient = await loadClientForCreate(req, parsed.data.client_id, db);
            if (!nextClient) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'Invalid client for this deal' });
            }
        }

        if (Object.prototype.hasOwnProperty.call(parsed.data, 'campaign_id') && parsed.data.campaign_id) {
            const nextCampaign = await loadCampaignForCreate(req, parsed.data.campaign_id, db);
            if (!nextCampaign) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'Invalid campaign for this deal' });
            }
            if (parsed.data.client_id && parsed.data.client_id !== nextCampaign.client_id) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'Campaign does not belong to the selected client' });
            }
            parsed.data.client_id = nextCampaign.client_id;
        }

        if (Object.prototype.hasOwnProperty.call(parsed.data, 'owner_id') && !(await validateOwner(req, parsed.data.owner_id, db))) {
            await db.query('ROLLBACK');
            return res.status(400).json({ error: 'Invalid owner for this deal' });
        }

        const columnMap = {
            client_id: 'client_id',
            campaign_id: 'campaign_id',
            owner_id: 'owner_id',
            title: 'title',
            priority: 'priority',
            deal_value: 'deal_value',
            due_date: 'due_date',
            tags: 'tags',
            stage: 'stage',
            contact_name: 'contact_name',
            contact_email: 'contact_email',
            probability: 'probability',
            notes: 'notes',
            blocker: 'blocker',
            is_archived: 'is_archived',
        };

        const fields = [];
        const values = [];
        for (const [key, column] of Object.entries(columnMap)) {
            if (Object.prototype.hasOwnProperty.call(parsed.data, key)) {
                values.push(parsed.data[key]);
                fields.push(`${column} = $${values.length}`);
            }
        }

        const activityEntries = [];
        if (parsed.data.stage && parsed.data.stage !== existing.stage) {
            activityEntries.push(`Deal moved to ${STAGE_LABELS[parsed.data.stage]}.`);
        }
        if (Object.prototype.hasOwnProperty.call(parsed.data, 'blocker') && parsed.data.blocker !== existing.blocker) {
            activityEntries.push(parsed.data.blocker ? 'Blocker added. This deal is now marked as blocked.' : 'Blocker removed.');
        }
        if (Object.prototype.hasOwnProperty.call(parsed.data, 'is_archived') && parsed.data.is_archived === true && existing.is_archived === false) {
            activityEntries.push('Deal archived.');
        }

        if (activityEntries.length > 0) {
            values.push(activityEntries[0]);
            fields.push(`last_activity_note = $${values.length}`, `last_activity_at = now()`);
        }

        fields.push(`updated_at = now()`);
        values.push(idParsed.data);

        await db.query(
            `UPDATE kanban_deals SET ${fields.join(', ')} WHERE id = $${values.length}`,
            values
        );

        if (activityEntries.length > 0) {
            const actorName = await getCurrentActor(req, db);
            for (const entry of activityEntries) {
                await db.query(
                    `INSERT INTO kanban_activity (deal_id, actor_id, actor_name, entry)
                     VALUES ($1, $2, $3, $4)`,
                    [idParsed.data, req.user.user_id, actorName, entry]
                );
            }
        }

        await db.query('COMMIT');

        const deal = await getDealResponse(req, idParsed.data);
        return res.json({ deal });
    } catch (err) {
        await db.query('ROLLBACK');
        throw err;
    } finally {
        db.release();
    }
}

export async function archiveDeal(req, res) {
    req.body = { is_archived: true };
    return updateDeal(req, res);
}
