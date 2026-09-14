/**
 * Sunucunun tek tip hata gövdesi (server/src/common/filters/all-exceptions.filter.ts).
 * İstemcinin bu şekli bilmesi, her çağrının kendi hata ayrıştırmasını
 * yazmasını gereksiz kılıyor.
 */
export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  path?: string;
  timestamp?: string;
}

/**
 * İki hata sınıfı var çünkü çağıranın ikisine tepkisi FARKLI:
 *
 * - `ApiError`: sunucuya ulaştık, sunucu hayır dedi. Kullanıcıya mesaj
 *   gösterilir, tekrar denemek genelde işe yaramaz.
 * - `NetworkError`: sunucuya hiç ulaşamadık. Kullanıcının hatası değil;
 *   çevrimdışı moda düşülür ve sonra tekrar denenir.
 *
 * Tek bir hata tipi olsaydı her çağıran `message.includes('network')` gibi
 * kırılgan kontroller yazardı.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: ApiErrorBody,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Oturum geçersiz — yeniden giriş gerekiyor. */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export class NetworkError extends Error {
  constructor(readonly cause?: unknown) {
    super('Sunucuya ulaşılamadı');
    this.name = 'NetworkError';
  }
}

/** Doğrulama hataları dizi olarak geliyor; kullanıcıya tek satır gösteriyoruz. */
export function errorMessage(error: unknown): string {
  if (error instanceof NetworkError) return 'Bağlantı yok. Çevrimdışı devam ediliyor.';
  if (error instanceof ApiError) {
    const m = error.body?.message ?? error.message;
    return Array.isArray(m) ? m[0] : m;
  }
  return 'Beklenmeyen bir hata oluştu';
}
