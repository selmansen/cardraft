/**
 * Sunucu yanıtlarının istemci tarafı tipleri.
 *
 * Elle yazılıyorlar çünkü sunucu tipleri ayrı bir pakette (server/) ve iki
 * tarafı tek npm workspace'ine almak henüz yapılmadı. Bu bir kopya ve kopya
 * ayrışabilir — bilinen borç. Motor kodunda aynı sorun `sync-engine.mjs` ile
 * çözüldü; API tipleri için de benzeri gerekecek.
 */

export type CurrencyCode = 'RIM' | 'COIN';
/**
 * Kesenin tel üzerindeki yazımı — motordaki `Currency` ile birebir aynı
 * (`src/types/index.ts`). Sunucu kart açmada büyük harfli `CurrencyCode`,
 * paket açmada küçük harfli bunu bekliyor; ikisi ayrı ayrı yazılı olduğu
 * için burada da ikisi ayrı duruyor. Birleştirmek sunucu DTO'larını
 * değiştirmeyi gerektirir, o ayrı bir iş.
 */
export type Currency = 'rim' | 'coin';
export type DifficultyId = 'easy' | 'normal' | 'hard';
export type DevicePlatform = 'IOS' | 'ANDROID';
export type IdentityProvider = 'APPLE' | 'GOOGLE';

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  isGuest: boolean;
  /** Hesaba bağlı giriş yolları. `/auth/me` dolduruyor; giriş yanıtlarında
   *  gelmiyor (orada zaten hangi sağlayıcıyla girildiği biliniyor). */
  providers?: IdentityProvider[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
  /**
   * Yalnızca misafir girişinde dolu. Sunucu üretiyor çünkü bu değer misafir
   * hesabın fiili giriş anahtarı ve React Native'de kriptografik rastgelelik
   * yok — `Math.random` ile üretilse tahmin edilebilir bir kimlik olurdu.
   * İstemci saklayıp sonraki açılışlarda geri gönderiyor.
   */
  installationId?: string;
}

export interface DeviceInfo {
  installationId: string;
  platform: DevicePlatform;
  appVersion?: string;
}

export interface BalanceSnapshot {
  currency: CurrencyCode;
  balance: number;
}

export type CardKind = 'VEHICLE' | 'SUPPORT';
export type AcquisitionSource = 'STARTER' | 'PURCHASE' | 'PACK' | 'REWARD';

export interface OwnedCard {
  cardId: string;
  kind: CardKind;
  source: AcquisitionSource;
  acquiredAt: string;
}

export interface UnlockResult {
  card: OwnedCard;
  balance: BalanceSnapshot;
}

export interface PlayerStats {
  battlesPlayed: number;
  battlesWon: number;
  winStreak: number;
  bestWinStreak: number;
}

export interface LoadoutEntryDto {
  cardId: string;
}

/** `POST /matches` yanıtı: tohum ve bot kurulumu sunucudan gelir. */
export interface OpenMatchResponse {
  matchId: string;
  seed: string;
  botLoadout: LoadoutEntryDto[];
  botSupportLoadout: string[];
  // Zorluk ayarları da sunucudan: istemci hangi zorluğu seçtiğini söyler,
  // o zorluğun ne anlama geldiğine sunucu karar verir.
  label: string;
  blurb: string;
  botGarageHp: number;
  playerGarageHp: number;
  playerOpeningHand: number;
  botOpeningHand: number;
  botBlunderChance: number;
  rewardMultiplier: number;
}

/** İstemcinin gönderdiği hamleler. "Kazandım" alanı YOK — bkz. ADR 0007. */
export interface SubmitActionDto {
  type: 'PLAY' | 'PLAY_SUPPORT' | 'ATTACK';
  handIndex?: number;
  scrapUid?: string;
  targetUid?: string;
  attackerUid?: string;
  target?: string;
}

export interface SubmitTurnDto {
  actions: SubmitActionDto[];
}

export interface SubmitMatchResponse {
  won: boolean;
  turns: number;
  /** Sunucunun gerçekten yazdığı ödül. İstemci bunu yeniden HESAPLAMAZ. */
  reward: number;
  balance: BalanceSnapshot;
  stats: PlayerStats;
}

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface CardPriceDto {
  rim: number;
  coin: number;
}

/**
 * Mağazadaki bir paket. Oranlar İSTEMCİDE SABİT DEĞİL, sunucudan geliyor:
 * ekranda gösterilen oranla çekilişte kullanılan oranın aynı olması hem
 * dürüstlük hem mağaza politikası meselesi (bkz. ADR 0013).
 */
export interface PackDto {
  id: string;
  name: string;
  blurb: string;
  price: CardPriceDto;
  /** Nadirlik → yüzde. Toplamı 100. Paketin çekemediği nadirlik hiç yok. */
  odds: Partial<Record<Rarity, number>>;
}

/** `GET /loadout` ve `PUT /loadout` yanıtı. */
export interface LoadoutDto {
  vehicleCardIds: string[];
  supportCardIds: string[];
  /** Sunucuda hiç kadro kaydı yoksa false — istemci o zaman yereldekini yazıyor. */
  saved: boolean;
}

/** `POST /store/packs/:id/open` yanıtı. */
export interface PackOpenResult {
  packId: string;
  card: { cardId: string; name: string; rarity: Rarity };
  /** Kart zaten koleksiyondaysa true — o zaman kart değil para geliyor. */
  duplicate: boolean;
  /** Harcanan miktar — `balance.currency` kesesinde. */
  spent: number;
  /** Tekrar kartın iadesi (aynı kesede); yeni kartta 0. */
  refund: number;
  /** Ödemenin yapıldığı kesenin açılış sonrası bakiyesi. */
  balance: BalanceSnapshot;
}
