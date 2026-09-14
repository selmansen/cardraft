-- TOKEN para birimi kaldırıldı: hiçbir zaman kazanılmadı ya da harcanmadı.
-- Ayrıldığı amaç (atölye/parça ekonomisi) Pit Ekibi kartlarına dönüştü.
CREATE TYPE "CurrencyCode_new" AS ENUM ('COIN', 'RIM');
ALTER TABLE "wallets"
  ALTER COLUMN "currency" TYPE "CurrencyCode_new"
  USING ("currency"::text::"CurrencyCode_new");
DROP TYPE "CurrencyCode";
ALTER TYPE "CurrencyCode_new" RENAME TO "CurrencyCode";
