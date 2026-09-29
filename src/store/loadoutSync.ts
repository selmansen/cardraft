import { loadoutApi } from '@/api/endpoints';
import { ApiError, NetworkError } from '@/api/errors';
import { useGameStore } from '@/store/gameStore';

/**
 * Kadroyu sunucuyla eşitleyen katman.
 *
 * NEDEN AYRI DOSYA: gameStore kadroyu tutuyor, sessionStore sunucuyu biliyor.
 * Eşitlemeyi gameStore'un içine koymak onu ağ katmanına bağımlı yapardı
 * (sessionStore zaten gameStore'u kullanıyor, ters yön döngü olurdu);
 * ekranların içine koymak ise her düzenleme yerinde tekrar yazmak olurdu.
 * Bu dosya gameStore'u biliyor, sessionStore'u BİLMİYOR: sessionStore buradan
 * `pullLoadout`u çağırdığı için ters yönde bir import döngü olurdu (ES
 * modülleri çalışma anında idare eder ama Metro'da eval sırası yüzünden
 * `undefined` binding'e dönüşebiliyor). Oturum bilgisine ihtiyaç duyan tek
 * yer `startLoadoutSync` ve o bilgi dışarıdan veriliyor.
 *
 * YEREL KAYIT SİLİNMEDİ ve silinmemeli: oyun çevrimdışı oynanabiliyor
 * (ADR 0003). Sunucu artık DOĞRULUK KAYNAĞI — açılışta oradan okunuyor ve her
 * değişiklik oraya yazılıyor — cihazdaki kopya ise yalnızca uçaktaki oyuncunun
 * kadrosunu görebilmesi için duran önbellek.
 */

/**
 * Yazma gecikmesi.
 *
 * Kadro ekranında her dokunuş kadroyu değiştiriyor; sekiz yuvayı düzenleyen
 * oyuncu saniyeler içinde onlarca değişiklik üretiyor. Her birini ayrı istek
 * yapmak hem gereksiz hem de sıralamanın bozulma riski (son yazan kazanıyor,
 * yani geç varan eski bir istek doğru kadronun üzerine yazabilir). 700 ms,
 * "elini çektiğinde kaydedilmiş olsun" hissini bozmayacak kadar kısa.
 */
const WRITE_DELAY_MS = 700;

/** İki kadro listesi aynı mı — sıra dahil, çünkü sıra oyuncunun dizilimi. */
function same(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * Açılışta kadroyu sunucudan yükler.
 *
 * Sunucuda kayıt VARSA o kazanıyor: cihaz değiştiren oyuncunun kadrosunu geri
 * vermenin tek yolu bu. Kayıt YOKSA (ilk kez ya da bu özellikten önce oynamış
 * oyuncu) cihazdaki kadro sunucuya yazılıyor — yani mevcut oyuncular
 * kadrolarını kaybetmiyor, sessizce taşınıyor.
 */
export async function pullLoadout(): Promise<void> {
  try {
    const remote = await loadoutApi.get();
    const game = useGameStore.getState();

    if (remote.saved) {
      game.setLoadouts(remote.vehicleCardIds, remote.supportCardIds);
      return;
    }

    // Sunucuda kayıt yok: yereldeki kadroyu yukarı taşı. Kadro geçersizse
    // (eksik kart, yanlış sayı) sunucu reddediyor ve yerelde kalıyor —
    // oyuncu kadro ekranında düzeltince yeniden denenecek.
    const { loadout, supportLoadout } = game;
    if (loadout.length === 0 && supportLoadout.length === 0) return;
    await loadoutApi.save(loadout, supportLoadout);
  } catch (error) {
    // Çevrimdışı ya da misafir: kadro cihazda kalıyor, oyun oynanmaya devam
    // ediyor. Kadro senkronu yüzünden açılışın durması, kazanılan şeyden çok
    // daha kötü olurdu.
    if (error instanceof NetworkError || error instanceof ApiError) return;
    throw error;
  }
}

/**
 * Kadro değişikliklerini sunucuya yazmaya başlar. Döndürdüğü işlev aboneliği
 * bitiriyor.
 */
export function startLoadoutSync(canWrite: () => boolean): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let last = {
    vehicles: useGameStore.getState().loadout,
    support: useGameStore.getState().supportLoadout,
  };

  const unsubscribe = useGameStore.subscribe((state) => {
    if (same(state.loadout, last.vehicles) && same(state.supportLoadout, last.support)) return;
    last = { vehicles: state.loadout, support: state.supportLoadout };

    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      // Misafirin kadrosu cihazda kalıyor: sunucu zaten 403 döndürür, boşuna
      // istek atmıyoruz. Kararı çağıran veriyor (bkz. dosya başı).
      if (!canWrite()) return;

      void loadoutApi.save(last.vehicles, last.support).catch(() => {
        // Sessiz geçiliyor. Oyuncu kadro kurarken "kaydedilemedi" uyarısı
        // almamalı: kadro yerelde duruyor, oyun oynanabiliyor ve bir sonraki
        // değişiklik ya da açılış yeniden deniyor. Gerçekten kaybedilen tek
        // şey, cihaz o anda değişirse son düzenleme.
      });
    }, WRITE_DELAY_MS);
  });

  return () => {
    if (timer) clearTimeout(timer);
    unsubscribe();
  };
}
