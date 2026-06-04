import { z } from 'zod';

export const kanbanStageSchema = z.enum(['backlog', 'qualified', 'proposal', 'negotiation', 'closedWon', 'closedLost']);
export const kanbanPrioritySchema = z.enum(['High', 'Medium', 'Low']);

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD');

export const createDealSchema = z.object({
    client_id: z.string().uuid().optional(),
    campaign_id: z.string().uuid().nullable().optional(),
    owner_id: z.string().uuid().nullable().optional(),
    title: z.string().min(1).max(255).trim().optional(),
    priority: kanbanPrioritySchema.optional(),
    deal_value: z.number().nonnegative().max(999999999999).optional(),
    due_date: dateSchema.optional(),
    tags: z.array(z.string().min(1).max(40).trim()).max(6).optional(),
    stage: kanbanStageSchema.optional(),
    contact_name: z.string().max(255).trim().nullable().optional(),
    contact_email: z.string().email().max(255).trim().nullable().optional(),
    probability: z.number().int().min(0).max(100).optional(),
    notes: z.string().max(5000).optional(),
    blocker: z.string().max(1000).nullable().optional(),
});

export const updateDealSchema = createDealSchema.partial().extend({
    is_archived: z.boolean().optional(),
});
