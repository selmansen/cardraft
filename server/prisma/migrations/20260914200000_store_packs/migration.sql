-- Paket açılışları ve iki yeni defter sebebi.
--
-- Enum'a DEĞER EKLEMEK güvenli (çıkarmak değil): var olan satırlar
-- etkilenmiyor. Yine de migration elle yazıldı — `migrate dev` bu projede
-- etkileşimli onay isteyebiliyor ve etkileşimsiz ortamda takılıyor.

ALTER TYPE "LedgerReason" ADD VALUE IF NOT EXISTS 'PACK_OPEN';
ALTER TYPE "LedgerReason" ADD VALUE IF NOT EXISTS 'PACK_DUPLICATE_REFUND';

CREATE TABLE "pack_openings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "packId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "rarity" TEXT NOT NULL,
    "duplicate" BOOLEAN NOT NULL,
    "spent" INTEGER NOT NULL,
    "refund" INTEGER NOT NULL DEFAULT 0,
    "requestId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pack_openings_pkey" PRIMARY KEY ("id")
);

-- Tekrar koruması: aynı requestId ile gelen ikinci istek yeni açılış yapamaz.
CREATE UNIQUE INDEX "pack_openings_userId_requestId_key" ON "pack_openings"("userId", "requestId");
CREATE INDEX "pack_openings_userId_createdAt_idx" ON "pack_openings"("userId", "createdAt");

ALTER TABLE "pack_openings" ADD CONSTRAINT "pack_openings_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
