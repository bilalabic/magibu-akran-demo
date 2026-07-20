import { z } from "zod";

// bcrypt 72 bayt sınırı nedeniyle şifre üst sınırı 72.
const passwordSchema = z
  .string({ error: "Şifre gerekli." })
  .min(8, "Şifre en az 8 karakter olmalı.")
  .max(72, "Şifre en fazla 72 karakter olabilir.");

const emailSchema = z.email({ error: "Geçerli bir e-posta adresi girin." }).max(254);

export const registerSchema = z.object({
  email: emailSchema,
  name: z
    .string({ error: "Ad soyad gerekli." })
    .trim()
    .min(2, "Ad soyad en az 2 karakter olmalı.")
    .max(100, "Ad soyad en fazla 100 karakter olabilir."),
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ error: "Şifre gerekli." }).min(1, "Şifre gerekli.").max(72),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string({ error: "Token gerekli." }).min(16, "Geçersiz token."),
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
