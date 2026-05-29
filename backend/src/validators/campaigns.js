import { z } from 'zod';

export const createCampaignSchema = z.object({
    client_id: z.string().uuid(),
    name: z.string().min(1).max(255).trim(),
    platform: z.enum(['google_ads', 'meta_ads', 'mailchimp', 'manual']),
    external_id: z.string().max(255).optional(),
    status: z.enum(['active', 'paused', 'completed']).default('active'),
    budget: z.number().positive().max(999999999999).optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD').optional(),
});

export const updateCampaignSchema = z.object({
    name: z.string().min(1).max(255).trim().optional(),
    platform: z.enum(['google_ads', 'meta_ads', 'mailchimp', 'manual']).optional(),
    external_id: z.string().max(255).optional(),
    status: z.enum(['active', 'paused', 'completed']).optional(),
    budget: z.number().positive().max(999999999999).optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const campaignQuerySchema = z.object({
    client_id: z.string().uuid().optional(),
    employee_id: z.string().uuid().optional(),
    platform: z.enum(['google_ads', 'meta_ads', 'mailchimp', 'manual']).optional(),
    status: z.enum(['active', 'paused', 'completed']).optional(),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});
