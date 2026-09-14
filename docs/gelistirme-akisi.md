# Geliştirme akışı — dallar, sürümler, yayın

Bu dosya "nasıl çalışıyoruz"un tek kaynağı: hangi dalda ne yapılır, commit
nasıl yazılır, sürüm numarası ne zaman artar, kod prod'a nasıl çıkar.

Kararların gerekçeleri de burada. Sebebi yazılmamış bir kural, ilk sıkıştığın
anda "bunu neden yapıyorduk ki" diye atlanır.

---

## 1. Dallar

```
main     ●────────────●────────────●        prod — yayınlanan kod, korumalı
          ↑            ↑            ↑
      app-v0.1.0   server-v0.2.0  app-v0.2.0
          │            │            │
develop  ●──●──●──●────●──●──●──●───●        staging — günlük geliştirme
             ↑     ↑         ↑
        feat/magaza-ekrani  feat/bot-olceklemesi
             │     │         │
           kısa ömürlü dallar, PR ile develop'a
```

| Dal | Ne demek | Kural |
|---|---|---|
| `main` | **Prod.** Yayınlanmış ya da yayınlanmaya hazır kod. | Doğrudan itme yok. Sadece `develop`'tan gelen PR ve acil düzeltme. Her yayın burada etiketlenir. |
| `develop` | **Staging.** Bir sonraki yayında ne varsa o. | Doğrudan itme yok (istisna: yazım hatası düzeltmesi gibi önemsiz şeyler). İşler PR ile gelir. |
| `feat/*`, `fix/*`, `chore/*`, `docs/*` | Tek bir iş. | `develop`'tan çıkar, `develop`'a döner, birleşince silinir. |

**Neden iki kalıcı dal?** Tek kişilik bir ekipte genelde gereksizdir — ama
burada bir mobil uygulama var ve mağazaya çıkan sürüm, bilgisayarındaki
koddan haftalarca geride kalabiliyor. `main` "oyuncunun telefonunda ne
çalışıyor" sorusunun cevabı olarak duruyor; `develop` ise senin çalıştığın
yer. İkisi ayrı olmazsa "şu an canlıda ne var" sorusunun cevabı yok.

İleride AWS'e çıkınca eşleme doğrudan oturuyor: `develop` → staging ortamı,
`main` → prod ortamı.

### Dal adlandırma

```
feat/magaza-ekrani        yeni özellik
fix/kadro-kaybolmasi      hata düzeltmesi
chore/surum-ve-ci-akisi   altyapı, bağımlılık, araç
docs/adr-0012             sadece belge
hotfix/token-yenileme     prod'u yakan acil düzeltme (main'den çıkar)
```

Türkçe, kısa, tireli. Dalın adı PR başlığını yazmanı kolaylaştırmalı.

---

## 2. Commit mesajları

[Conventional Commits](https://www.conventionalcommits.org/tr/):

```
<tür>(<kapsam>): <ne yaptığı, küçük harfle, emir kipinde>
```

**Türler:** `feat` · `fix` · `chore` · `docs` · `refactor` · `test` · `perf`

**Kapsam** (isteğe bağlı ama faydalı): `app`, `server`, `battle`, `economy`,
`inventory`, `ci`…

```
feat(inventory): kart açma sunucuya taşındı
fix(battle): sürükleme hedefi kaydırmadan sonra yanlış ölçülüyordu
chore(ci): GitHub Actions iş akışı eklendi
docs(adr): 0011 — envanterin sunucuya taşınması
```

Bu biçimin tek pratik faydası okunabilirlik değil: sürüm yükseltmesinin
`patch` mi `minor` mü olacağına bakarken `git log` üzerinden `feat` var mı
diye bakmak yetiyor.

**Gövdede** ne yaptığını değil **neden** yaptığını yaz. Ne yaptığını diff
zaten gösteriyor.

---

## 3. Bir işin baştan sona yolu

```bash
# 1. develop'u güncelle, dalını çık
git checkout develop && git pull
git checkout -b feat/magaza-ekrani

# 2. çalış, küçük commit'ler at

# 3. itmeden önce kendi kontrolün (CI'ın koşacağının aynısı)
npm run typecheck                                   # istemci
cd server && npm run lint && npm run build && npm test && cd ..

# 4. it ve PR aç (hedef: develop)
git push -u origin feat/magaza-ekrani
```

PR'da CI yeşile dönünce birleştir (**squash merge**) ve dalı sil.

**Neden squash:** feature dalındaki "wip", "düzeltme", "yine düzeltme"
commit'leri `develop`'ın geçmişinde bir işe yaramıyor. Squash sonrası
`develop`'ın günlüğü "ne değişti" listesine dönüşüyor — CHANGELOG yazarken
bakılan yer tam olarak burası.

> `develop` → `main` birleştirmesi **merge commit** ile yapılır, squash ile
> değil: orada amaç geçmişi düzleştirmek değil, "bu yayında şunlar vardı"
> bağını korumak.

---

## 4. Sürümleme

İki ayrı yayınlanabilir parça var, iki ayrı sürüm numarası:

| Parça | Sürüm nerede | Etiket | Günlük |
|---|---|---|---|
| Mobil uygulama | `app.json` (`expo.version`) + `package.json` | `app-v0.2.0` | `CHANGELOG.md` |
| Sunucu (API) | `server/package.json` | `server-v0.3.1` | `server/CHANGELOG.md` |

**Neden ayrı:** sunucuyu günde birkaç kez yayınlayabilirsin, uygulamayı mağaza
onayı yüzünden ayda bir. Tek numara kullanılsaydı sunucudaki tek satırlık bir
düzeltme, hiç değişmemiş uygulamanın sürümünü de zıplatırdı — ve "oyuncunun
telefonundaki 0.4.0 hangi API ile konuşuyor" sorusu cevapsız kalırdı.

### Numara ne zaman artar (SemVer, 0.x sürecinde)

| Artış | Ne zaman |
|---|---|
| `major` (1.0.0) | İlk mağaza yayınına kadar **artmıyor**. 0.x boyunca kırıcı değişiklik serbest. |
| `minor` (0.**2**.0) | Yeni özellik, yeni uç nokta, yeni ekran. Ya da istemciyi kıran API değişikliği. |
| `patch` (0.1.**1**) | Hata düzeltmesi, denge ayarı, metin değişikliği, altyapı. |

**İstemciyi kıran sunucu değişikliği `minor`'dur** — mağazadaki eski
uygulamalar hâlâ eski API'yi çağırıyor olacak. Kırıcı bir değişiklik
gerektiğinde doğru yol sürümü zıplatmak değil, `/api` önekini `/api/v2`
yapmak (`src/bootstrap.ts`'te tek satır) ve eskisini bir süre yaşatmak.

### Yayın adımları

```bash
# 1. develop → main PR'ını birleştir (merge commit), sonra:
git checkout main && git pull

# 2. sürümü yükselt, CHANGELOG'u kapat, etiketi oluştur
node scripts/release.mjs server minor      # ya da: app patch

# 3. script ne yaptığını yazar; doğruysa it
git push origin main server-v0.2.0
```

Etiket itilince `.github/workflows/release.yml` çalışır ve CHANGELOG'daki o
sürümün bölümünü sürüm notu yaparak GitHub Release oluşturur.

Script bilerek **itmiyor**: etiket itmek dışarı dönük ve geri alması zor bir
iş. Hazırlığı otomatik, tetiği elle.

> Yayından önce `CHANGELOG`'un "Yayınlanmamış" bölümünde bir şey yazıyor
> olmalı — boşsa script durur. Yayınlanacak bir şey yoksa yayın da yoktur.

---

## 5. Acil düzeltme (hotfix)

Prod yanıyorsa `develop`'ın hazır olmasını bekleme:

```bash
git checkout main && git pull
git checkout -b hotfix/token-yenileme
# düzelt, PR aç → main
# birleşince:
node scripts/release.mjs server patch
git push origin main server-v0.2.1
# ve düzeltmeyi develop'a da taşı, yoksa bir sonraki yayında geri gelir:
git checkout develop && git merge main && git push
```

Son adım unutulmaya en müsait olanı ve unutulursa düzelttiğin hata bir sonraki
yayında aynen geri gelir.

---

## 6. CI neyi kontrol ediyor

`main` ve `develop`'a giden her PR'da ([`.github/workflows/ci.yml`](../.github/workflows/ci.yml)):

**İstemci** — `npm ci` → `tsc --noEmit` → `expo export`

`expo export` sadece "derleniyor mu" kontrolü değil: eksik asset, çözülemeyen
import ve bozuk Metro yapılandırması tsc'ye görünmez, ancak paketleme
sırasında ortaya çıkar. Olmasa bunları telefonda fark ederdin.

**Sunucu** — `npm ci` → `lint` → `build` → `migrate deploy` → `test` → `test:e2e`

Gerçek Postgres ve Redis konteynerleriyle koşuyor. Sahte veritabanıyla
koşmak, e2e'nin cevap vermesi gereken tek soruyu ("parçalar birbirine
bağlanıyor mu") sormadan geçmek olurdu.

`build` adımı ayrıca `sync-engine.mjs`'i tetikliyor: savaş motorunun istemci
kopyası sunucuya taşınıyor ve orada da derleniyor. Motor iki tarafta
ayrışmışsa CI bunu yakalar — maç doğrulamasının dayandığı şey tam olarak bu
iki kopyanın aynı olması.

---

## 7. Ortamlar ve sırlar

| Ortam | Dal | Durum |
|---|---|---|
| Yerel | herhangi | `server/docker-compose.yml` (Postgres + Redis), `.env` |
| Staging | `develop` | **Henüz yok** — AWS'e çıkınca kurulacak |
| Prod | `main` | **Henüz yok** |

Sırlar hiçbir zaman repoya girmiyor. `server/.env` gitignore'lu;
`server/.env.example` şablon olarak repoda duruyor ve hangi değişkenlerin
gerektiğini anlatıyor. CI'daki JWT sırları tek kullanımlık sahte değerler
(`ci.yml` içinde açıkta) — gerçek ortamlar GitHub Secrets kullanacak.

Bir env değişkeni eklerken üç yeri birden güncelle: `src/config/env.schema.ts`,
`.env.example` ve `.github/workflows/ci.yml`. Şema zorunlu tutup diğer ikisi
güncellenmezse CI, uygulama daha açılmadan patlar.

---

## 8. GitHub'da elle yapılması gerekenler

Bu ayarlar repoda dosya olarak tutulamıyor, GitHub arayüzünden bir kez
yapılıyor:

1. **Varsayılan dal `develop` olsun** — *Settings → General → Default branch*.
   Böylece yeni PR'lar öntanımlı olarak `develop`'a açılır; yanlışlıkla
   `main`'e açılan PR en sık yapılan hata.
2. **`main` korunsun** — *Settings → Rules → Rulesets → New branch ruleset*,
   hedef `main`:
   - Restrict deletions
   - Require a pull request before merging
   - Require status checks to pass → `İstemci (Expo / React Native)`,
     `Sunucu (NestJS)`
   - Block force pushes
3. **`develop` korunsun** — aynısı, ama PR zorunluluğu isteğe bağlı.
4. **Birleştirme ayarları** — *Settings → General → Pull Requests*:
   "Allow squash merging" ve "Allow merge commits" açık, "Allow rebase
   merging" kapalı; "Automatically delete head branches" açık.

> Tek kişilik ekipte dal koruması kendine engel koymak gibi görünüyor ama asıl
> işi bu: yorgunken `main`'e doğrudan itmeni engelliyor. CI'ın zorunlu olması
> da "sonra bakarım"ı imkânsız hale getiriyor.
