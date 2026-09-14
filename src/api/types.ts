/**
 * Sunucu yanıtlarının istemci tarafı tipleri.
 *
 * Elle yazılıyorlar çünkü sunucu tipleri ayrı bir pakette (server/) ve iki
 * tarafı tek npm workspace'ine almak henüz yapılmadı. Bu bir kopya ve kopya
 * ayrışabilir — bilinen borç. Motor kodunda aynı sorun `sync-engine.mjs` ile
 * çözüldü; API tipleri için de benzeri gerekecek.
 */

export type CurrencyCode = 'RIM' | 'COIN';
export type DifficultyId = 'easy' | 'normal' | 'hard';
export type DevicePlatform = 'IOS' | 'ANDROID';

export interface AuthUser {
  id: string;
  email: string | null;
  displayName: string | null;
  isGuest: boolean;
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
  balance: BalanceSnapshot;
  stats: PlayerStats;
}
