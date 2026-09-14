import { useGameStore } from './gameStore';
import { useSessionStore } from './sessionStore';

/**
 * "Kaç jantım var?" sorusunun TEK cevabı.
 *
 * `useCollection` ile aynı sebep: iki kaynak var — sunucudaki bakiye
 * (doğruluk kaynağı, ADR 0006/0008) ve cihazdaki yerel kopya (çevrimdışı
 * yedek) — ve ekranların hangisini okuyacağını tek tek bilmesi gerekmiyor.
 *
 * Koleksiyon için bu kanca yazılmıştı, cüzdan için yazılmamıştı; sonuç tam da
 * öngörülen hata oldu: menü çevrimdışıyken yerel bakiyeyi gösteriyordu, Kadro
 * / kart detayı / mağaza ise doğrudan sunucu değerini okuduğu için **0 jant**
 * gösteriyordu. Aynı oyuncuya aynı anda iki farklı bakiye.
 */
export interface Wallet {
  rims: number;
  coins: number;
  /** Sunucudan mı okundu? Satın alma yalnızca çevrimiçiyken mümkün. */
  fromServer: boolean;
}

export function useWallet(): Wallet {
  const online = useSessionStore((s) => s.connection) === 'online';
  const serverRims = useSessionStore((s) => s.rims);
  const serverCoins = useSessionStore((s) => s.coins);
  const localRims = useGameStore((s) => s.rims);
  const localCoins = useGameStore((s) => s.coins);

  return online
    ? { rims: serverRims, coins: serverCoins, fromServer: true }
    : { rims: localRims, coins: localCoins, fromServer: false };
}
