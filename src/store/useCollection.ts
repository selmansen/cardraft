import { useMemo } from 'react';

import { useGameStore } from './gameStore';
import { useSessionStore } from './sessionStore';

/**
 * "Bu karta sahip miyim?" sorusunun TEK cevabı.
 *
 * İki kaynak var — sunucudaki koleksiyon (doğruluk kaynağı) ve cihazdaki
 * yerel kopya (çevrimdışı yedek) — ve ekranların hangisini okuyacağını tek
 * tek bilmesi gerekmiyor. Bu kanca olmasaydı dört ekran aynı "online mı,
 * değil mi" dallanmasını ayrı ayrı yazardı ve biri unutulduğunda o ekran
 * sessizce yanlış koleksiyonu gösterirdi.
 *
 * Çevrimdışıyken yerel kopyaya düşmek bir güvenlik açığı değil: yerel liste
 * yalnızca NE GÖSTERİLECEĞİNİ belirliyor. Maça çıkarken kadronun gerçekten
 * sahip olunan kartlardan oluştuğu sunucuda ayrıca doğrulanıyor
 * (MatchService.open), yani cihazdaki listeyi düzenlemek işe yaramıyor.
 */
export interface Collection {
  has: (cardId: string) => boolean;
  count: number;
  /** Sunucudan mı okundu? Kilit açma yalnızca çevrimiçiyken mümkün. */
  fromServer: boolean;
}

function useSource(remote: Set<string>, local: Record<string, unknown>): Collection {
  const online = useSessionStore((s) => s.connection) === 'online';

  return useMemo(() => {
    if (online) {
      return { has: (id: string) => remote.has(id), count: remote.size, fromServer: true };
    }
    return {
      has: (id: string) => local[id] != null,
      count: Object.keys(local).length,
      fromServer: false,
    };
  }, [online, remote, local]);
}

/** Araç koleksiyonu. */
export function useVehicleCollection(): Collection {
  return useSource(
    useSessionStore((s) => s.ownedVehicles),
    useGameStore((s) => s.collection),
  );
}

/** Pit Ekibi koleksiyonu. */
export function useSupportCollection(): Collection {
  return useSource(
    useSessionStore((s) => s.ownedSupport),
    useGameStore((s) => s.supportCollection),
  );
}
