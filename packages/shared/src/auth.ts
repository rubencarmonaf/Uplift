import { z } from 'zod';

export const emailSchema = z.email().trim().toLowerCase();

export const passwordSchema = z.string().min(10).max(128);

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: emailSchema,
  password: passwordSchema,
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const userSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  locale: z.enum(['es', 'en']),
});
export type User = z.infer<typeof userSchema>;

export const organizationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: z.enum(['admin', 'editor', 'viewer']),
});
export type Organization = z.infer<typeof organizationSchema>;

export const meResponseSchema = z.object({
  user: userSchema,
  organizations: z.array(organizationSchema),
});
export type MeResponse = z.infer<typeof meResponseSchema>;
