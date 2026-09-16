import { api } from '@/api/client';
import { errorMessage } from '@/api/errors';
import { useSessionStore } from '@/store/sessionStore';

/**
 * GEÇİCİ — GELİŞTİRME ARACI. Silinmek üzere yazıldı.
 *
 * Apple/Google istemci kimlikleri ve geliştirme derlemesi henüz yok, yani
 * test cihazında gerçek giriş yapılamıyor ve girişe bağlı akışlar (paket
 * açma, kart alma, koleksiyon) denenemiyor.
 *
 * Bu dosya o boşluğu tek yerde kapatıyor: sahte sağlayıcı jetonuyla sabit bir
 * test hesabına giriyor, sonra cüzdana bakiye yazıyor. İkisi de GERÇEK uçlar
 * üzerinden — kestirme yok, denenen şey gerçek akışın kendisi.
 *
 * SİLİNİRKEN: bu dosya, app/sign-in.tsx'teki `__DEV__` bloğu,
 * sessionStore'daki `devSubject` parametresi ve sunucudaki
 * `server/src/modules/dev/` klasörü birlikte gider.
 */

/**
 * Sabit: hangi cihazdan girilirse girilsin aynı test hesabı açılıyor.
 *
 * Kısa tutulamıyor — sunucu `idToken` için en az 20 karakter istiyor ve
 * gönderilen jeton `sahte:<subject>` biçiminde.
 */
const DEV_SUBJECT = 'cardraft-test-hesabi';

/** Paketleri denemeye yetecek kadar — temel paket 350, nadir+ 800 jant. */
const DEV_RIM = 20_000;
const DEV_COIN = 2_000;

export interface DevLoginResult {
  rims: number;
  coins: number;
}

/**
 * Test hesabına girer ve cüzdanı doldurur.
 *
 * @returns Hata mesajı, ya da başarılıysa yeni bakiyeler.
 */
export async function devAdminLogin(): Promise<string | DevLoginResult> {
  const session = useSessionStore.getState();

  // Giriş gerçek uçtan: sunucu misafiri yükseltiyor ve hoş geldin hediyesini
  // yazıyor, yani denenen akış oyuncununkiyle aynı.
  const failure = await session.signInWithProvider('GOOGLE', DEV_SUBJECT);
  if (failure === 'cancelled') return 'Giriş iptal edildi.';
  if (failure) return failure;

  try {
    await api.post<unknown>('/dev/grant', { rim: DEV_RIM, coin: DEV_COIN });
  } catch (error) {
    return errorMessage(error);
  }

  await useSessionStore.getState().refreshWallet();
  const after = useSessionStore.getState();
  return { rims: after.rims, coins: after.coins };
}
