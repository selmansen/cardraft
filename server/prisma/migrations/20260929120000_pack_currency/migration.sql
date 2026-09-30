-- Paket açılışına kese kolonu.
--
-- Varsayılan RIM: bu kolon eklenmeden önceki bütün açılışlar jantla yapıldı
-- (paketlerin coin fiyatı yoktu), yani mevcut satırlar için doğru değer bu.
-- NOT NULL + DEFAULT birlikte veriliyor ki geçmiş satırlar tek adımda dolsun.
ALTER TABLE "pack_openings"
  ADD COLUMN "currency" "CurrencyCode" NOT NULL DEFAULT 'RIM';
