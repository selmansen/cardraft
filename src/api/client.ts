import { API_BASE_URL, REQUEST_TIMEOUT_MS } from './config';
import { ApiError, NetworkError, type ApiErrorBody } from './errors';
import { tokenStore, type SessionTokens } from './tokens';

type Method = 'GET' | 'POST' | 'DELETE';

interface RequestOptions {
  method?: Method;
  body?: unknown;
  /** Kimlik gerektirmeyen uç noktalar (auth/guest, auth/login, health). */
  anonymous?: boolean;
  signal?: AbortSignal;
}

/** Oturum değiştiğinde haberdar olmak isteyenler (store, UI). */
type SessionListener = (tokens: SessionTokens | null) => void;
const listeners = new Set<SessionListener>();
export function onSessionChange(fn: SessionListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let cached: SessionTokens | null = null;
let loaded = false;

async function currentTokens(): Promise<SessionTokens | null> {
  if (!loaded) {
    cached = await tokenStore.read();
    loaded = true;
  }
  return cached;
}

export async function setTokens(tokens: SessionTokens | null): Promise<void> {
  cached = tokens;
  loaded = true;
  if (tokens) await tokenStore.write(tokens);
  else await tokenStore.clear();
  listeners.forEach((fn) => fn(tokens));
}

export async function hasSession(): Promise<boolean> {
  return (await currentTokens()) !== null;
}

/**
 * Yenileme TEK UÇUŞLU olmak zorunda.
 *
 * Sunucu refresh token'ı rotasyonla veriyor: her yenilemede eskisi iptal
 * ediliyor. Uygulama açılışında üç istek birden 401 alırsa ve üçü de ayrı
 * yenileme başlatırsa, ilki başarılı olur ve diğer ikisi ARTIK İPTAL EDİLMİŞ
 * bir token'la yenilemeye çalışır — sunucu haklı olarak reddeder ve kullanıcı
 * sebepsiz yere oturumdan atılır.
 *
 * Bu yüzden ilk yenileme sözü paylaşılıyor: sonrakiler yenisini başlatmak
 * yerine aynı sözü bekliyor.
 */
let refreshInFlight: Promise<SessionTokens | null> | null = null;

async function refreshTokens(): Promise<SessionTokens | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const tokens = await currentTokens();
    if (!tokens) return null;
    try {
      const fresh = await rawRequest<{ accessToken: string; refreshToken: string }>(
        '/auth/refresh',
        { method: 'POST', body: { refreshToken: tokens.refreshToken }, anonymous: true },
      );
      const next = { accessToken: fresh.accessToken, refreshToken: fresh.refreshToken };
      await setTokens(next);
      return next;
    } catch (error) {
      // Yenileme reddedildiyse oturum gerçekten bitmiş: temizle. Ağ hatasıysa
      // oturumu SİLME — kullanıcı sadece çevrimdışı, geri geldiğinde
      // token'ları hâlâ geçerli olabilir.
      if (error instanceof ApiError) await setTokens(null);
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

/** Yenileme denemeyen ham istek — refresh'in kendisi bunu kullanıyor,
 *  yoksa 401 alan bir yenileme kendini sonsuz çağırırdı. */
async function rawRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, anonymous, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (!anonymous) {
    const tokens = await currentTokens();
    if (tokens) headers.Authorization = `Bearer ${tokens.accessToken}`;
  }

  // Zaman aşımı: RN'in fetch'inde yerleşik bir süre sınırı yok, sunucu
  // yanıt vermezse istek sonsuza kadar asılı kalır ve UI bekler.
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
  if (signal) signal.addEventListener('abort', () => timeout.abort(), { once: true });

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: timeout.signal,
    });
  } catch (error) {
    throw new NetworkError(error);
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const parsed: unknown = text ? safeJson(text) : undefined;

  if (!response.ok) {
    const errorBody = parsed as ApiErrorBody | undefined;
    const message = Array.isArray(errorBody?.message)
      ? errorBody.message[0]
      : (errorBody?.message ?? `HTTP ${response.status}`);
    throw new ApiError(response.status, message, errorBody);
  }
  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Uygulamanın kullandığı istek fonksiyonu: 401 alırsa bir kez yenileyip
 * tekrar dener.
 *
 * Neden tek deneme: ikinci 401, token'ın süresinin dolmasından değil
 * yetkinin gerçekten olmamasından geliyordur. Tekrar denemek sonsuz döngüye
 * dönerdi.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  try {
    return await rawRequest<T>(path, options);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401 || options.anonymous) throw error;
    const refreshed = await refreshTokens();
    if (!refreshed) throw error;
    return rawRequest<T>(path, options);
  }
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  del: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
