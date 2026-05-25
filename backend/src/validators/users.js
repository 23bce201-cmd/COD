import { z } from 'zod';

export const createUserSchema = z.object({
    email: z.string().email().max(255).trim().toLowerCase(),
    name: z.string().min(1).max(255).trim(),
    role: z.enum(['manager', 'employee'], {
        errorMap: () => ({ message: "Role must be 'manager' or 'employee'" }),
    }),
    manager_id: z.string().uuid().nullable().optional(),
    password: z
        .string()
        .min(8)
        .max(128)
        .regex(/[A-Z]/, 'Must contain uppercase')
        .regex(/[a-z]/, 'Must contain lowercase')
        .regex(/[0-9]/, 'Must contain digit')
        .regex(/[^A-Za-z0-9]/, 'Must contain special character')
        .optional(), // Optional — if not provided, a temp password is auto-generated
});

export const updateUserSchema = z.object({
    name: z.string().min(1).max(255).trim().optional(),
    email: z.string().email().max(255).trim().toLowerCase().optional(),
    role: z.enum(['manager', 'employee']).optional(),
    manager_id: z.string().uuid().nullable().optional(),
    is_active: z.boolean().optional(),
});
