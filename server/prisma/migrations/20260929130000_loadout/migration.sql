-- Oyuncunun kayıtlı kadrosu.
--
-- Kadro cihazda tutuluyordu; cihaz değiştiren oyuncu koleksiyonunu geri alıyor
-- ama kadrosunu sıfırdan kuruyordu. Kart kimlikleri yabancı anahtar değil:
-- kart tanımları kodda, veritabanında kart tablosu yok.
CREATE TABLE "loadouts" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId"         UUID NOT NULL,
  "vehicleCardIds" TEXT[] NOT NULL,
  "supportCardIds" TEXT[] NOT NULL,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "loadouts_pkey" PRIMARY KEY ("id")
);

-- Kullanıcı başına tek kadro. İleride isimli birden fazla kadro gerekirse bu
-- kısıt kaldırılıp isim kolonu eklenir; veri taşımak gerekmez.
CREATE UNIQUE INDEX "loadouts_userId_key" ON "loadouts"("userId");

ALTER TABLE "loadouts"
  ADD CONSTRAINT "loadouts_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
