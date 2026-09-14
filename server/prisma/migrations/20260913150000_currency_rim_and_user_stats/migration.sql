-- Para birimi modeli LoL'ün "mavi öz / RP" düzenine geçti:
--   COIN = gerçek parayla satın alınan (premium)
--   RIM  = oynayarak kazanılan (arayüzde "jant")
-- GEM kaldırıldı: premium rolünü artık COIN üstleniyor, iki premium para
-- birimi tutmanın bir anlamı yok.

-- 1) Yeni enum. Postgres'te enum'dan değer ÇIKARILAMADIĞI için tip yeniden
--    yaratılıp kolon ona taşınıyor — Prisma'nın da kendi ürettiği desen bu.
CREATE TYPE "CurrencyCode_new" AS ENUM ('COIN', 'RIM', 'TOKEN');
ALTER TABLE "wallets"
  ALTER COLUMN "currency" TYPE "CurrencyCode_new"
  USING ("currency"::text::"CurrencyCode_new");
DROP TYPE "CurrencyCode";
ALTER TYPE "CurrencyCode_new" RENAME TO "CurrencyCode";

-- 2) Mevcut COIN bakiyeleri maç ödülüydü, yani oynayarak kazanılmıştı.
--    Yeni modelde bu paranın adı RIM. Olduğu yerde bırakmak, oyunculara
--    hiç ödemedikleri premium para vermek olurdu.
UPDATE "wallets" SET "currency" = 'RIM' WHERE "currency" = 'COIN';

-- 3) Oyuncu istatistikleri artık sunucuda: bot seviyesi ve ileride lig
--    bunlara dayanacağı için cihazda tutulamazlar.
CREATE TABLE "user_stats" (
  "userId" UUID NOT NULL,
  "battlesPlayed" INTEGER NOT NULL DEFAULT 0,
  "battlesWon" INTEGER NOT NULL DEFAULT 0,
  "winStreak" INTEGER NOT NULL DEFAULT 0,
  "bestWinStreak" INTEGER NOT NULL DEFAULT 0,
  "lastBattleAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_stats_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "user_stats"
  ADD CONSTRAINT "user_stats_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
