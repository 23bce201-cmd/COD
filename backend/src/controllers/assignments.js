import { query } from '../services/db.js';
import { uuidParamSchema } from '../validators/clients.js';

// ─── GET /api/assignments ───────────────────────────────────
// Query: ?manager_id=... or ?client_id=... (admin only)
export async function listAssignments(req, res) {
    const manager_id = req.query.manager_id;
    const client_id = req.query.client_id;

    const conditions = [];
    const values = [];
    let i = 1;

    if (manager_id) {
        conditions.push(`mca.manager_id = $${i}`);
        values.push(manager_id);
        i++;
    }
    if (client_id) {
        conditions.push(`mca.client_id = $${i}`);
        values.push(client_id);
        i++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await query(
        `SELECT mca.id, mca.manager_id, mca.client_id, mca.assigned_at,
                u.name AS manager_name, u.email AS manager_email,
                c.name AS client_name,
                assigner.name AS assigned_by_name
         FROM manager_client_assignments mca
         JOIN users u ON u.id = mca.manager_id
         JOIN clients c ON c.id = mca.client_id
         LEFT JOIN users assigner ON assigner.id = mca.assigned_by
         ${where}
         ORDER BY mca.assigned_at DESC`,
        values
    );

    return res.json({ assignments: result.rows });
}

// ─── POST /api/assignments ──────────────────────────────────
// Assign a client to a manager (admin only)
export async function createAssignment(req, res) {
    const { manager_id, client_id } = req.body;
    if (!manager_id || !client_id) {
        return res.status(400).json({ error: 'manager_id and client_id are required' });
    }

    // Verify the user is actually a manager
    const managerCheck = await query(
        `SELECT id, role FROM users WHERE id = $1 AND is_active = true`,
        [manager_id]
    );
    if (managerCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Manager not found' });
    }
    if (managerCheck.rows[0].role !== 'manager') {
        return res.status(400).json({ error: 'User is not a manager' });
    }

    // Verify the client exists
    const clientCheck = await query(
        `SELECT id FROM clients WHERE id = $1 AND is_active = true`,
        [client_id]
    );
    if (clientCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Client not found' });
    }

    // Check if already assigned
    const existing = await query(
        `SELECT id FROM manager_client_assignments WHERE manager_id = $1 AND client_id = $2`,
        [manager_id, client_id]
    );
    if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Client is already assigned to this manager' });
    }

    const result = await query(
        `INSERT INTO manager_client_assignments (manager_id, client_id, assigned_by)
         VALUES ($1, $2, $3)
         RETURNING id, manager_id, client_id, assigned_at`,
        [manager_id, client_id, req.user.user_id]
    );

    return res.status(201).json({
        assignment: result.rows[0],
        message: 'Client assigned to manager successfully',
    });
}

// ─── DELETE /api/assignments/:id ────────────────────────────
// Unassign a client from a manager (admin only)
export async function deleteAssignment(req, res) {
    const idParsed = uuidParamSchema.safeParse(req.params.id);
    if (!idParsed.success) return res.status(400).json({ error: 'Invalid assignment ID' });

    const result = await query(
        `DELETE FROM manager_client_assignments WHERE id = $1 RETURNING id`,
        [idParsed.data]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
    return res.json({ message: 'Client unassigned from manager' });
}
