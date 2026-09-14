import { z } from 'zod';

/**
 * Ortam değişkenlerinin tek doğruluk kaynağı.
 *
 * Neden şema ile doğruluyoruz: eksik ya da yanlış bir env değişkeni, onu ilk
 * kullanan istek geldiğinde patlar — yani üretimde, rastgele bir kullanıcının
 * üstünde, anlamsız bir hata mesajıyla. Şema, uygulamayı daha açılışta
 * durdurur ("fail fast"): hangi değişkenin neden geçersiz olduğu tek bir net
 * mesajda söylenir. Ayrıca bu dosya, projeye yeni bakan birinin "hangi
 * env'ler gerekli" sorusunun cevabı oluyor.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL zorunlu'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),

  // Üretimde zayıf sır kullanılmasını şemada engelliyoruz: 32 karakter alt
  // sınırı, "secret123" gibi bir değerin sessizce canlıya çıkmasını önler.
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET en az 32 karakter olmalı'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET en az 32 karakter olmalı'),
  // Biçim burada zorlanıyor ("15m", "30d"): TokenService bunu ayrıştırırken
  // hatalı bir değerin çalışma zamanında patlamasını beklemek yerine,
  // uygulamayı açılışta durduruyoruz.
  JWT_ACCESS_TTL: z
    .string()
    .regex(/^\d+[smhd]$/, "JWT_ACCESS_TTL '15m' biçiminde olmalı")
    .default('15m'),
  JWT_REFRESH_TTL: z
    .string()
    .regex(/^\d+[smhd]$/, "JWT_REFRESH_TTL '30d' biçiminde olmalı")
    .default('30d'),
});

export type Env = z.infer<typeof envSchema>;

/** ConfigModule'ün `validate` kancasına verilir. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Ortam değişkenleri geçersiz:\n${detail}`);
  }
  return parsed.data;
}
