# Mağaza ekranları — tasarım kaynağı

Bu klasördeki `.dc.html` dosyaları mağaza ekranlarının tasarım kaynağı.
Canlı tuval (görüntülemek ve PNG/PDF almak için):
https://claude.ai/code/artifact/8ac1f5db-ea1b-48fd-a3b7-6a4b8f5376d6

| Dosya | Ekran |
|---|---|
| `Main.dc.html` | Mağaza — iki paket, oran özetleri, iade kuralı |
| `OranTablosu.dc.html` | Oran modalı — paketin "Detay"ına dokununca açılır |
| `YetersizBakiye.dc.html` | Bakiye yetmediğinde açılan alt sayfa |
| `PaketAcilis.dc.html` | Paket açılışı (dokunmadan önce) |
| `YeniKart.dc.html` | Yeni kart çıktı |
| `TekrarKart.dc.html` | Sahip olunan kart çıktı → %25 jant iadesi |

`canvas.json` tuvaldeki yerleşimi ve notları tutuyor.

## Değerler nereden geliyor

Renk, tipografi, yarıçap, gölge ve buton anatomisi `src/constants/theme.ts`
ile mevcut ekranlardan **birebir** alındı — tasarımda yeni bir değer
üretilmedi. Paket fiyatları ve oranlar
[ADR 0010](../../../server/docs/adr/0010-pvp-timing-packs-and-monetisation.md)'dan,
iade oranı da aynı karardan geliyor.

## Kapsam dışı bırakılanlar

- **Coin ile alım.** Coin'in gerçek para karşılığı henüz belirlenmedi ve coin
  bütün satın alma akışlarına (paket, kart, ileride kozmetik) tek seferde
  eklenecek. Bu yüzden bu ekranlarda yalnızca jant var.
- **Alt gezinme.** Menü yapısı profil/lig/mesaj eklenirken yeniden ele
  alınacak; ekranlarda bugünkü hâliyle, değiştirilmeden çizildi.

## Yeniden üretmek

Üretilen tuval dosyası (`.html`, ~2,4 MB) depoya girmiyor — içinde düzenleyici
kodu var ve her seferinde yeniden üretilebiliyor. Kaynak bu klasördeki
`.dc.html` dosyaları; değişiklik onlarda yapılır, sonra tuval yeniden
üretilip aynı adrese yayımlanır.
