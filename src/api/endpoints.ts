import { api } from './client';
import type {
  AuthTokens,
  IdentityProvider,
  AuthUser,
  BalanceSnapshot,
  CurrencyCode,
  DeviceInfo,
  DifficultyId,
  OpenMatchResponse,
  OwnedCard,
  PackDto,
  PackOpenResult,
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

  /**
   * Apple / Google ile giriş — tek gerçek giriş yolu.
   *
   * Oturum ŞART: uygulama açılışta zaten misafir hesap alıyor ve bu çağrı o
   * hesabın üstüne yapılıyor. Böylece tek uç üç işi birden görüyor —
   * misafiri yükseltmek, daha önce bağlanmış hesaba dönmek, ve cihaz
   * değiştiren oyuncunun hesabını geri vermek.
   *
   * `force`: sağlayıcı hesabı BAŞKA bir CarDraft hesabına bağlıysa ve
   * buradaki misafirin ilerlemesi varsa sunucu 409 döner. Onaysız geçiş
   * oyuncunun saatlerini sessizce silmek olurdu; onayı istemci alıyor.
   */
  signInWithProvider: (body: DeviceInfo & { provider: IdentityProvider; idToken: string; force?: boolean }) =>
    api.post<AuthTokens>('/auth/identity', body),

  /**
   * Hesabı ve bağlı bütün veriyi siler.
   *
   * Bağlı hesapta sağlayıcıdan TAZE jeton gerekiyor: silme geri alınamaz ve
   * access token 15 dakika yaşıyor. Misafir hesapta kimlik yok, gövde boş.
   */
  deleteAccount: (confirmation?: { provider: IdentityProvider; idToken: string }) =>
    api.del<void>('/auth/account', confirmation ?? {}),

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

export const storeApi = {
  /** Paketler, fiyatları ve oranlarıyla. Oranlar istemcide sabit yazılmıyor. */
  packs: () => api.get<PackDto[]>('/store/packs'),

  /**
   * Paket açar.
   *
   * `requestId` tekrar koruması: cevabı kaybolan bir istek tekrar
   * gönderilirse sunucu yeni çekiliş yapmaz, ilk sonucu döndürür. Bu yüzden
   * kimliği çağıran ÜRETİP SAKLAMALI — her denemede yenisini üretmek
   * korumayı işlevsiz kılar (bkz. ADR 0013).
   */
  openPack: (packId: string, requestId: string) =>
    api.post<PackOpenResult>(`/store/packs/${packId}/open`, { requestId }),
};

export const matchApi = {
  /** Tohum ve bot kurulumu sunucudan gelir — istemci tohum seçemez. */
  open: (body: { difficulty: DifficultyId; vehicleCardIds: string[]; supportCardIds: string[] }) =>
    api.post<OpenMatchResponse>('/matches', body),

  /** Gövdede "kazandım" YOK: sunucu maçı yeniden oynatıp kendi karar veriyor. */
  submit: (matchId: string, turns: SubmitTurnDto[]) =>
    api.post<SubmitMatchResponse>(`/matches/${matchId}/submit`, { turns }),
};

export const statsApi = {
  /** Oyuncunun kendi istatistikleri — sayaçlar yalnızca doğrulanmış maç
   *  sonucuyla arttığı için bunlar sunucunun bildiği gerçek rakamlar. */
  me: () => api.get<PlayerStats>('/stats/me'),
};

export const deviceApi = {
  register: (body: DeviceInfo & { fcmToken?: string }) => api.post<unknown>('/devices', body),
};

export type { PlayerStats };
