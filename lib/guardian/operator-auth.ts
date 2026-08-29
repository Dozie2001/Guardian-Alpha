import { z } from "zod";

export const GuardianCredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export type GuardianCredentials = z.infer<typeof GuardianCredentialsSchema>;

export function authorizeGuardianOperator(credentials: unknown) {
  const parsed = GuardianCredentialsSchema.safeParse(credentials);
  if (!parsed.success) {
    return null;
  }

  const expectedEmail = process.env.GUARDIAN_AUTH_EMAIL?.trim().toLowerCase();
  const expectedPassword = process.env.GUARDIAN_AUTH_PASSWORD;

  if (!expectedEmail || !expectedPassword) {
    return null;
  }

  const email = parsed.data.email.trim().toLowerCase();
  if (email !== expectedEmail || parsed.data.password !== expectedPassword) {
    return null;
  }

  return {
    id: "guardian-operator",
    name: "Guardian Operator",
    email
  };
}
