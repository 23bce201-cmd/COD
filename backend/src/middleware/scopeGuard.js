import { query } from '../services/db.js';

/**
 * scopeGuard — enforces client-level data isolation across all app roles.
 *
 * Roles (DB stores 'agency_admin' but app treats it as 'admin'):
 *
 *   admin (agency_admin in DB):
 *     - Full access to all clients — passes through any client_id from request
 *
 *   manager:
 *     - Can only access clients assigned via manager_client_assignments
 *     - Loads assigned client IDs on each request and validates
 *     - Returns 403 if they try to access an unassigned client
 *
 *   employee:
 *     - Can only access clients whose campaigns they are assigned to (employee_campaign_assignments)
 *     - Returns 403 if they try to access an unassigned client
 *
 *   client:
 *     - Locked to their own client_id (from JWT)
 *     - Returns 403 if they explicitly try to access another client's data
 *     - Logs repeated 403s and alerts on 5+ within 10 minutes
 */

// In-memory tracker for repeated 403s from client users
const forbiddenTracker = new Map(); // user_id → [{ timestamp }...]

function cleanOldEntries(entries) {
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    return entries.filter((e) => e.timestamp > tenMinAgo);
}

/**
 * Map DB role to app role.
 * DB stores 'agency_admin' but the app uses 'admin' everywhere.
 */
export function mapRole(dbRole) {
    if (dbRole === 'agency_admin') return 'admin';
    return dbRole;
}

export async function scopeGuard(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
    }

    const role = req.user.role; // Already mapped in verifyToken

    // ─── Admin — full access ────────────────────────────────
    if (role === 'admin') {
        req.scopedClientId = req.params.client_id || req.params.id || req.body?.client_id || req.query?.client_id || null;
        return next();
    }

    // ─── Manager — assigned clients only ────────────────────
    if (role === 'manager') {
        const requestedClientId =
            req.params.client_id || req.params.id || req.body?.client_id || req.query?.client_id;

        // Load assigned client IDs for this manager
        const assignmentResult = await query(
            `SELECT client_id FROM manager_client_assignments WHERE manager_id = $1`,
            [req.user.user_id]
        );
        const assignedClientIds = assignmentResult.rows.map((r) => r.client_id);

        // Store on request for downstream use
        req.assignedClientIds = assignedClientIds;

        if (requestedClientId) {
            if (!assignedClientIds.includes(requestedClientId)) {
                console.error(
                    `[SCOPE-GUARD 403] manager user_id=${req.user.user_id} tried to access unassigned client_id=${requestedClientId} at ${new Date().toISOString()}`
                );
                return res.status(403).json({ error: 'Access denied — client not assigned to you' });
            }
            req.scopedClientId = requestedClientId;
        } else {
            // No specific client requested — downstream handlers can use assignedClientIds
            req.scopedClientId = null;
        }
        return next();
    }

    // ─── Employee — campaigns' assigned clients only ────────
    if (role === 'employee') {
        const requestedClientId =
            req.params.client_id || req.params.id || req.body?.client_id || req.query?.client_id;

        // Load assigned client IDs from campaigns assigned to this employee via join table
        const assignmentResult = await query(
            `SELECT DISTINCT c.client_id 
             FROM campaigns c
             JOIN employee_campaign_assignments eca ON eca.campaign_id = c.id
             WHERE eca.employee_id = $1`,
            [req.user.user_id]
        );
        const assignedClientIds = assignmentResult.rows.map((r) => r.client_id);

        // Store on request for downstream use
        req.assignedClientIds = assignedClientIds;

        if (requestedClientId) {
            if (!assignedClientIds.includes(requestedClientId)) {
                console.error(
                    `[SCOPE-GUARD 403] employee user_id=${req.user.user_id} tried to access unassigned client_id=${requestedClientId} at ${new Date().toISOString()}`
                );
                return res.status(403).json({ error: 'Access denied — client not assigned to your campaigns' });
            }
            req.scopedClientId = requestedClientId;
        } else {
            req.scopedClientId = null;
        }
        return next();
    }

    // ─── Client — own data only ─────────────────────────────
    if (role === 'client') {
        const userClientId = req.user.client_id;
        const requestedClientId =
            req.params.client_id || req.params.id || req.body?.client_id || req.query?.client_id;

        // If they explicitly specified a DIFFERENT client_id, log and block
        if (requestedClientId && requestedClientId !== userClientId) {
            const userId = req.user.user_id;
            console.error(
                `[SCOPE-GUARD 403] user_id=${userId} endpoint=${req.method} ${req.originalUrl} timestamp=${new Date().toISOString()}`
            );

            // Track repeated 403s
            let entries = forbiddenTracker.get(userId) || [];
            entries = cleanOldEntries(entries);
            entries.push({ timestamp: Date.now() });
            forbiddenTracker.set(userId, entries);

            if (entries.length >= 5) {
                console.error(
                    `[SCOPE-GUARD ALERT] user_id=${userId} has triggered ${entries.length} forbidden access attempts in the last 10 minutes`
                );
            }

            return res.status(403).json({ error: 'Access denied' });
        }

        // Always force the client's own client_id
        req.scopedClientId = userClientId;
        return next();
    }

    // Unknown role — deny
    return res.status(403).json({ error: 'Unknown role' });
}

/**
 * Middleware factory — requires one or more roles.
 * Usage:
 *   requireRole('admin')
 *   requireRole('admin', 'employee')
 */
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        next();
    };
}
