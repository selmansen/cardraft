-- E-posta + şifre girişi kaldırıldı: tek giriş yolu Apple/Google.
--
-- Şifre olmayınca şifre sıfırlama, e-posta doğrulama, kaba kuvvet ve hesap
-- sayımı yüzeyleri de olmuyor. Sağlayıcı hem kimliği hem e-postayı bizden
-- daha iyi doğruluyor. Bkz. ADR 0015.

DROP TABLE IF EXISTS "auth_tokens";
DROP TYPE IF EXISTS "TokenPurpose";

ALTER TABLE "users" DROP COLUMN IF EXISTS "passwordHash";
ALTER TABLE "users" DROP COLUMN IF EXISTS "emailVerifiedAt";
