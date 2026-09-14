import { battleReward as engineReward, type Difficulty } from '../../game-engine/game/difficulty.js';
import { CurrencyCode, LedgerReason } from '../../generated/prisma/enums.js';

/**
 * Ödül miktarlarının TEK kaynağı — ve bilinçli olarak sunucuda.
 *
 * İstemcide de bu sayılar var (Faz 1'de WIN_REWARD/LOSS_REWARD), ama orası
 * artık yalnızca "kullanıcıya ne göstereceğiz" içindir. Gerçek bakiye
 * buradaki değerlere göre değişir. İstemcinin gönderdiği bir miktar hiçbir
 * yerde kabul edilmiyor: gönderdiği tek şey "maçı kazandım/kaybettim".
 *
 * Fark önemli: istemci "bana 5000 coin ver" diyemiyor, sadece "maç bitti"
 * diyebiliyor — ve o maçın ne kadar ettiğine sunucu karar veriyor.
 */
/**
 * Maç ödülü — jant (RIM) olarak. Coin ASLA oynayarak kazanılmıyor: coin'in
 * tek kaynağı gerçek para. İki para birimini karıştırmak, ücretsiz oyuncunun
 * premium para biriktirmesine yol açar ve satın almanın anlamını yok eder.
 *
 * Miktarın kendisi burada DEĞİL, paylaşılan motorda (`game/difficulty.ts`)
 * duruyor ve `scripts/sync-engine.mjs` ile buraya kopyalanıyor. Sebep: aynı
 * sayıyı iki yerde tutmayı bir kez denedik ve istemci 170'e çıkarken sunucu
 * 120'de kaldı — oyuncuya gösterilen ödülle bakiyesine yazılan ödül tutmadı.
 * Sunucu hâlâ otorite; sadece otoritenin okuduğu dosya tek.
 */

/**
 * Hoş geldin hediyesi — hesap BAĞLANDIĞINDA veriliyor, misafir açılışında değil.
 *
 * Misafir oyuncunun cüzdanı 0: misafirlik bir deneme, ilerleme değil. Bu,
 * "giriş yapmazsan ne kaybedersin" sorusunu da ortadan kaldırıyor — kaybedecek
 * bir şey birikmiyor, dolayısıyla hesap devralma çakışması diye bir durum da
 * yok.
 *
 * Tutar Temel paketin fiyatına EŞİT (350). Değerlendirme ekranı oyuncuya
 * "paketler aç" diye söz veriyorsa, giriş yaptıktan sonra ilk yapabileceği şey
 * o olmalı — vaat ile deneyim aynı anda tutmalı. 300 olsaydı oyuncu girer
 * girmez pakete 50 jant yetiştiremezdi.
 */
export const SIGNUP_BONUS_RIM = 350;

export interface BattleRewardOutcome {
  amount: number;
  currency: CurrencyCode;
  reason: LedgerReason;
}

export function battleReward(won: boolean, difficulty: Difficulty): BattleRewardOutcome {
  return {
    amount: engineReward(won, difficulty),
    currency: CurrencyCode.RIM,
    reason: LedgerReason.BATTLE_REWARD,
  };
}
