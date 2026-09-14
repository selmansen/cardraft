import { api } from './client';
import type {
  AuthTokens,
  AuthUser,
  BalanceSnapshot,
  CurrencyCode,
  DeviceInfo,
  DifficultyId,
  OpenMatchResponse,
  OwnedCard,
  PlayerStats,
  SubmitMatchResponse,
  SubmitTurnDto,
  UnlockResult,
} from './types';

/**
 * Uç noktalar sunucudaki modüllere birebir karşılık gelecek şekilde
 * gruplandı. Tek bir düz `apiCall('/auth/guest')` listesi yerine bunu tercih
 * etmenin sebebi: bir uç noktanın yolu değiştiğinde tek yerde değişmesi ve
 * çağıran tarafın yol dizesi (`'/economy/wallet'`) yazmak zorunda kalmaması —
 * yazım hatası derleme zamanında değil çalışma zamanında patlardı.
 */

export const authApi = {
  /**
   * Misafir giriş. `installationId` ilk açılışta GÖNDERİLMEZ: sunucu üretip
   * yanıtta döner (istemcide kriptografik rastgelelik yok — bkz. server
   * GuestLoginDto). Sonraki açılışlarda saklanan değer gönderilir ve aynı
   * hesaba dönülür.
   */
  guest: (device: Omit<DeviceInfo, 'installationId'> & { installationId?: string }) =>
    api.post<AuthTokens>('/auth/guest', device, { anonymous: true }),

  register: (body: { email: string; password: string; displayName?: string } & DeviceInfo) =>
    api.post<AuthTokens>('/auth/register', body, { anonymous: true }),

  login: (body: { email: string; password: string } & DeviceInfo) =>
    api.post<AuthTokens>('/auth/login', body, { anonymous: true }),

  /** Misafir → gerçek hesap, ilerleme kaybolmadan. */
  link: (body: { email: string; password: string; displayName?: string }) =>
    api.post<AuthTokens>('/auth/link', body),

  logout: (refreshToken: string) =>
    api.post<void>('/auth/logout', { refreshToken }, { anonymous: true }),

  me: () => api.get<AuthUser>('/auth/me'),
};

export const economyApi = {
  wallet: () => api.get<BalanceSnapshot[]>('/economy/wallet'),
};

export const inventoryApi = {
  list: () => api.get<OwnedCard[]>('/inventory'),

  /** İstemci FİYAT göndermiyor — sadece hangi kart ve hangi keseden.
   *  Fiyata sunucu karar veriyor. */
  unlock: (cardId: string, currency: CurrencyCode) =>
    api.post<UnlockResult>('/inventory/unlock', { cardId, currency }),
};

export const matchApi = {
  /** Tohum ve bot kurulumu sunucudan gelir — istemci tohum seçemez. */
  open: (body: { difficulty: DifficultyId; vehicleCardIds: string[]; supportCardIds: string[] }) =>
    api.post<OpenMatchResponse>('/matches', body),

  /** Gövdede "kazandım" YOK: sunucu maçı yeniden oynatıp kendi karar veriyor. */
  submit: (matchId: string, turns: SubmitTurnDto[]) =>
    api.post<SubmitMatchResponse>(`/matches/${matchId}/submit`, { turns }),
};

export const deviceApi = {
  register: (body: DeviceInfo & { fcmToken?: string }) => api.post<unknown>('/devices', body),
};

export type { PlayerStats };
