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
  /** Temporary account from "Try the demo". */
  isDemo: z.boolean(),
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

export const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    locale: z.enum(['es', 'en']),
  })
  .partial();
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(80),
});
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

export type Member = {
  userId: string;
  name: string;
  email: string;
  role: 'admin' | 'editor' | 'viewer';
  isYou: boolean;
};
