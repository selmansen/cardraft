# Cardraft — Tasarım Sistemi

Bu doküman, Cardraft'ın görsel dilini (renk, tipografi, bileşen stilleri) tanımlar. Ekranları kodlarken referans olarak kullanılacak; React Native tarafında `theme.ts` gibi bir dosyaya birebir aktarılabilir.

**Genel his**: Enerjik, kontrastlı, "arena" hissi veren — tatlı/pastel değil, aksiyon dolu bir çarpışma oyununa yakışan bir görsel dil. Bu yüzden **koyu bir arka plan temeli** üzerine **parlak mavi ve turuncu-amber vurgular** kullanıyoruz; düz beyaz/pastel bir arka plan yerine.

---

## 1. Renk Paleti

### Marka / Ana Renkler
| Token | Hex | Kullanım |
|---|---|---|
| `primary` | `#2E7BE0` | Ana marka rengi — logo, birincil butonlar, vurgular |
| `primaryDark` | `#0C447C` | Koyu mavi — başlık metinleri, aktif/basılı durumlar |
| `primaryLight` | `#85B7EB` | Açık mavi — ikincil vurgular, seçili durum arka planı |

### Enerji / Aksiyon Rengi (İkincil)
| Token | Hex | Kullanım |
|---|---|---|
| `accent` | `#F2A93B` | Amber/turuncu — çarpışma efektleri, "saldırı" butonu, önemli CTA'lar, ödül/kilit açma vurguları |
| `accentDark` | `#B5710F` | Amber üzerine yazı, basılı durum |

### Durum Renkleri (Semantic)
| Token | Hex | Kullanım |
|---|---|---|
| `success` | `#4CAF6D` | Kazanma, kart açma, upgrade başarılı |
| `danger` | `#E24B4A` | Can/dayanıklılık düşük, kart kaybı, hata mesajı |
| `warning` | `#F2A93B` | Uyarı (accent ile aynı ton kullanılabilir) |

### Nötr / Arka Plan (Koyu Tema Temeli)
| Token | Hex | Kullanım |
|---|---|---|
| `background` | `#0F1420` | Ana ekran arka planı (koyu lacivert-siyah, "arena" hissi) |
| `surface` | `#1B2333` | Kart/panel arka planı (background'dan bir ton açık) |
| `surfaceElevated` | `#263049` | Öne çıkan paneller, modal arka planı |
| `border` | `#33405A` | İnce ayraç çizgileri |
| `textPrimary` | `#F5F7FA` | Ana metin (koyu arka plan üzerinde beyaza yakın) |
| `textSecondary` | `#9AA6BF` | İkincil/açıklama metni |
| `textMuted` | `#6B7690` | Devre dışı, ipucu metni |

**Not**: Koyu tema burada varsayılan/tek tema olarak düşünüldü (oyunun kendisi için). Menü/ayarlar gibi standart ekranlarda okunabilirlik için kontrastlara dikkat edilecek.

### Kart Nadirlik Renkleri (ileride Faz 3'te kullanılacak, şimdiden ayrılıyor)
| Nadirlik | Hex |
|---|---|
| Common (Yaygın) | `#9AA6BF` (gri-mavi) |
| Rare (Nadir) | `#2E7BE0` (mavi) |
| Epic (Efsanevi) | `#B673E0` (mor) |
| Legendary (Destansı) | `#F2A93B` (amber, parlak) |

---

## 2. Tipografi

### Fontlar (Google Fonts, OFL lisanslı — ticari kullanıma açık)
- **Başlık / Vurgu Fontu**: **Titan One** — logo, ekran başlıkları, büyük sayılar (güç/stat gösterimi gibi dramatik yerler)
- **Gövde / UI Fontu**: **Nunito** (600/700 ağırlık) — buton metni, kart açıklamaları, liste öğeleri, genel arayüz metni. Titan One'a göre daha okunaklı, sayı/stat gösteriminde daha net.

### Ölçek
| Stil | Font | Boyut | Ağırlık | Kullanım |
|---|---|---|---|---|
| `display` | Titan One | 32px | - | Logo, splash ekranı |
| `h1` | Titan One | 24px | - | Ekran başlıkları |
| `h2` | Nunito | 20px | 700 | Bölüm başlıkları |
| `body` | Nunito | 16px | 600 | Genel metin, buton |
| `bodySmall` | Nunito | 14px | 600 | İkincil bilgi, açıklama |
| `caption` | Nunito | 12px | 700 | Etiket, rozet metni |
| `statNumber` | Titan One | 20px | - | Kart üzerindeki güç/hız gibi büyük stat rakamları |

---

## 3. Spacing & Radius

| Token | Değer |
|---|---|
| `space.xs` | 4px |
| `space.sm` | 8px |
| `space.md` | 16px |
| `space.lg` | 24px |
| `space.xl` | 32px |
| `radius.sm` | 8px (butonlar, küçük öğeler) |
| `radius.md` | 12px (kartlar, paneller) |
| `radius.lg` | 20px (modal, büyük paneller) |

---

## 4. Bileşen Stilleri

### Oyun Kartı (Game Card)
- Boyut oranı: yaklaşık 3:4 (dikey, klasik oyun kartı oranı)
- Arka plan: `surface`, kenarlık: nadirlik rengine göre 2px border
- Üst kısım: araç görseli (kare/dikdörtgen alan)
- Alt kısım: kart adı (`h2`), stat satırı (güç/hız/dayanıklılık ikonlarıyla, `statNumber`)
- Seçili/aktif durumda: `primary` renginde 3px glow-benzeri border (gölge yerine border kalınlığı artırılarak, flat tasarım korunur)
- Seviye rozeti: kartın sağ üst köşesinde küçük dairesel rozet, `accent` arka plan + koyu metin

### Butonlar
- **Birincil (Primary)**: `primary` arka plan, `textPrimary` renginde metin, `radius.sm`, dolgun (filled)
- **İkincil (Secondary)**: şeffaf arka plan, `border` renginde 1.5px kenarlık, `textPrimary` metin
- **Aksiyon/Saldırı (Action)**: `accent` arka plan, koyu metin (`accentDark` yerine yüksek kontrast için `#1B2333` kullanılabilir) — savaş ekranındaki "saldır" gibi butonlar için ayrılmış
- **Tehlike (Danger)**: `danger` arka plan — kart silme, vazgeçme gibi geri alınamaz aksiyonlar

### Üst Bar / Navigasyon
- Arka plan: `surfaceElevated`
- Aktif sekme: `primary` renginde ikon + alt çizgi
- Pasif sekme: `textSecondary`

### Rozet / Etiket (Badge)
- Küçük, `radius.sm` yuvarlatılmış, dolgu rengi durum semantiğine göre (`success`/`danger`/`accent`), `caption` font ile

---

## 5. İkonlar
- Basit, dolgu (filled) tarzı ikon seti kullanılacak (ör. Feather Icons, Ionicons — React Native'de `react-native-vector-icons` veya Expo'nun kendi `@expo/vector-icons` paketi ile hazır geliyor, ekstra lisans derdi yok).
- İkon rengi bağlama göre `textPrimary`, `accent` veya `primary`.

---

## Sonraki Adım
Bu tasarım sistemini referans alarak ilk ekranların (Ana Menü, Kart Koleksiyonu/Galeri, Kart Detay, Bot Savaş Ekranı) wireframe/mockup çalışmasına geçilecek, ardından React Native bileşenlerine dökülecek.
