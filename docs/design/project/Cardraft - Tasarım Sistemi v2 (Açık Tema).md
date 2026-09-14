# Cardraft — Tasarım Sistemi v2 (Açık Tema)

Bu doküman v1'in (koyu tema) üzerine, kullanıcı isteğiyle **açık ve canlı** bir temaya güncellenmiş halidir. Yapı aynı — token isimleri v1 ile birebir eşleşiyor, sadece değerler değişti. `theme.ts`'e birebir aktarılabilir.

**Genel his**: Sıcak krem zemin, beyaz kartlar, doygun mavi/turuncu/mor/pembe vurgular — oyuncaklı ve canlı, ama okunabilir.

---

## 1. Renk Paleti

### Marka / Ana Renkler
| Token | Hex | Kullanım |
|---|---|---|
| `primary` | `#3A7BF0` | Ana marka rengi — logo, birincil butonlar, vurgular |
| `primaryDark` | `#1E4FB0` | Basılı durum, buton alt gölgesi |
| `primarySoft` | `#DCE9FF` | Seçili durum arka planı, bilgi kutusu |

### Enerji / Aksiyon Rengi (İkincil)
| Token | Hex | Kullanım |
|---|---|---|
| `accent` | `#FF9522` | Turuncu — "saldır" butonu, ödül/kilit açma vurguları |
| `accentSoft` | `#FFF0DC` | Rozet zemini, ipucu şeridi |
| `accentInk` | `#B35C00` | Turuncu üzerine yazı (metin, ikon) |

### Ek Vurgu Renkleri
| Token | Hex | Kullanım |
|---|---|---|
| `grape` | `#A15CF5` | Epic nadirlik, kutlama efekti |
| `grapeInk` | `#7B32D6` | Mor üzerine/yanına yazı |
| `bubble` | `#FF6FA5` | Mesaj/emoji şeridi, "yeni kart" vurgusu |

### Durum Renkleri (Semantic)
| Token | Hex | Kullanım |
|---|---|---|
| `success` | `#2FBF6B` | Kazanma, kart açma, upgrade başarılı (dolgu olarak `#137A40` kullan — kontrast için) |
| `danger` | `#F04A47` | Can/dayanıklılık düşük, kart kaybı (dolgu olarak `#D93835`/`#C22C29` kullan) |
| `warning` | `#FFC53D` | Uyarı, süre azalıyor |

### Nötr / Arka Plan (Açık Tema Temeli)
| Token | Hex | Kullanım |
|---|---|---|
| `background` | `#FBF7F0` | Ana ekran arka planı (sıcak krem) |
| `surface` | `#FFFFFF` | Kart/panel arka planı |
| `surfaceSunken` | `#F3EEE4` | Stat kutusu, bar kanalı, çekmece zemin |
| `border` | `#EBE3D6` | İnce ayraç çizgileri, kart kenarı |
| `textPrimary` | `#1E2436` | Ana metin |
| `textSecondary` | `#6B7285` | İkincil/açıklama metni |
| `textMuted` | `#A0A6B5` | Devre dışı, ipucu metni |

**Kontrast kuralı (önemli)**: Turuncu (`accent`) ve pembe (`bubble`) dolgular üzerine **koyu mürekkep** (`#1E2436`) kullan — beyaz metin bu tonlarda 4.5:1'in altında kalıyor. Yeşil ve kırmızı dolgular üzerine beyaz metin kullanılabilir, ama dolguyu koyulaştır (`success` dolgusu `#137A40`, `danger` dolgusu `#C22C29`/`#D93835`). 24px altı her metin bu kurala uyar.

### Kart Nadirlik Renkleri
| Nadirlik | Hex |
|---|---|
| Common (Yaygın) | `#A0A6B5` |
| Rare (Nadir) | `#3A7BF0` |
| Epic (Efsanevi) | `#A15CF5` |
| Legendary (Destansı) | `#FF9522` |

---

## 2. Tipografi

### Fontlar (Google Fonts, OFL — ticari kullanıma açık, tam Türkçe desteği var)
- **Başlık / Vurgu Fontu**: **Baloo 2** (800 ağırlık) — logo, ekran başlıkları, büyük sayılar. *v1'deki Titan One'ın yerine geçti: Titan One'da ı/ğ/ş gibi Türkçe karakterlerin desteği güvenilir değildi.*
- **Gövde / UI Fontu**: **Nunito** (600/700/900 ağırlık) — buton metni, kart açıklamaları, liste öğeleri, genel arayüz metni.

### Ölçek
| Stil | Font | Boyut | Ağırlık | Kullanım |
|---|---|---|---|---|
| `display` | Baloo 2 | 34px | 800 | Logo, splash ekranı |
| `h1` | Baloo 2 | 26px | 800 | Ekran başlıkları |
| `h2` | Nunito | 20px | 700 | Bölüm başlıkları |
| `body` | Nunito | 16px | 600 | Genel metin, buton |
| `bodySmall` | Nunito | 14px | 600 | İkincil bilgi, açıklama |
| `caption` | Nunito | 12px | 700 | Etiket, rozet metni |
| `statNumber` | Baloo 2 | 20-22px | 800 | Kart üzerindeki güç/hız gibi stat rakamları |

---

## 3. Spacing, Radius & Gölge

| Token | Değer |
|---|---|
| `space.xs` | 4px |
| `space.sm` | 8px |
| `space.md` | 16px |
| `space.lg` | 24px |
| `space.xl` | 32px |
| `radius.sm` | 12px (stat kutusu) |
| `radius.md` | 18px (kartlar, paneller) |
| `radius.lg` | 28px (modal, ekran bloğu) |
| `radius.pill` | 999px (rozet, sekme, buton) |

**Gölge**: Açık temada hiyerarşi kenarlıkla değil gölgeyle kuruluyor.
- `shadow.card`: `0 3px 10px rgba(30,36,54,.05)` — standart kart
- `shadow.raised`: `0 8px 22px rgba(30,36,54,.10)` — öne çıkan panel
- `shadow.chunky`: `0 4px 0 <tokenInk>` — buton alt gölgesi (basılınca kaybolur, buton 4px aşağı iner — "tuş" hissi)

---

## 4. Bileşen Stilleri

### Oyun Kartı (Game Card)
- Boyut oranı: ~3:4 (dikey)
- Arka plan: `surface` (beyaz), kenarlık: nadirlik rengine göre 2px
- Görsel alanı: nadirlik renginin ~%10 açık tonuyla dolu zemin (kart uzaktan da renginden tanınıyor)
- Seviye rozeti: sağ üstte küçük beyaz daire, hafif gölge
- Ad: `h1` (Baloo 2) · Nadirlik + tip: pill etiket, nadirlik renginin soft tonunda zemin
- Stat satırı: 3 eşit kutu (`surfaceSunken` zemin), `statNumber`
- Seçili durumda: `primary` renginde 3px çerçeve + hafif mavi gölge
- "Yeni" rozeti: sol altta, `bubble` zemin + koyu mürekkep metin

### Butonlar
- Yükseklik 52px, radius `pill`, `shadow.chunky` alt gölge; basılı durumda gölge kaybolur, 4px aşağı iner
- **Birincil (Primary)**: `primary` zemin, beyaz metin
- **İkincil (Secondary)**: beyaz zemin, `primarySoft` 2px kenarlık, `primary` metin
- **Aksiyon/Saldırı (Action)**: `accent` zemin, **koyu mürekkep** metin (`#1E2436`) — savaş ekranındaki "SALDIR" için ayrılmış
- **Tehlike (Danger)**: `#D93835` zemin (danger'ın koyultulmuş hali), beyaz metin

### Üst Bar / Navigasyon
- Sekme çubuğu: `surfaceSunken` zemin, pill şekli; aktif sekme beyaz "kabarcık" içinde + `shadow.raised`
- Pasif sekme ikonu/metni: `textSecondary`

### Rozet / Etiket (Badge)
- `radius.pill`, durum semantiğine göre dolgu:
  - success → `#137A40` zemin + beyaz metin
  - danger → `#C22C29` zemin + beyaz metin
  - accent/bubble → ilgili zemin + **koyu mürekkep** metin
  - neutral/locked → `surfaceSunken` zemin + `textSecondary` metin

---

## 5. İkonlar
- Basit, dolgu (filled) tarzı ikon seti (Ionicons / `@expo/vector-icons`), v1'deki karar geçerli.
- İkon rengi bağlama göre `textPrimary`, `accent` veya `primary`.

---

## Sonraki Adım
Açık tema onaylandı. Faz 1 ekranlarının (Ana Menü, Kart Koleksiyonu/Galeri, Kart Detay, Bot Savaş Ekranı) mockup çalışmasına bu sistem üzerinden geçilecek. Açık noktalar: kart görsellerinin kaynağı (çizim / satın alma / AI), final ikon seti, kart açma animasyonu dili.
