import { CARDS, STARTER_CARD_IDS, getCard } from '../../game-engine/data/cards.js';
import {
  SUPPORT_CARDS,
  STARTER_SUPPORT_IDS,
  getSupportCard,
} from '../../game-engine/data/supportCards.js';
import type { CardPrice } from '../../game-engine/types/index.js';
import { CardKind } from '../../generated/prisma/enums.js';

/**
 * Kart kataloğu — sunucunun kartlar hakkında bildiği her şeyin tek kapısı.
 *
 * Katalog veritabanında DEĞİL, senkronlanan motorda: kart tanımları oyunun
 * kurallarının parçası ve maç doğrulaması aynı tanımları görmek zorunda.
 * Fiyatları ayrıca veritabanına da yazsaydık iki doğruluk kaynağı olurdu ve
 * biri güncellenip diğeri unutulduğunda oyuncu yanlış fiyat öderdi — bu tam
 * olarak ödül miktarlarında yaşadığımız hata (bkz. ADR 0009).
 *
 * Bu dosya iki havuzu (araç / Pit Ekibi) tek arayüz altında topluyor, böylece
 * InventoryService'in "hangi havuzdan" diye dallanması gerekmiyor.
 */
export interface CatalogEntry {
  cardId: string;
  kind: CardKind;
  name: string;
  price: CardPrice;
}

function vehicle(id: string): CatalogEntry {
  const c = getCard(id);
  return { cardId: c.id, kind: CardKind.VEHICLE, name: c.name, price: c.price };
}

function support(id: string): CatalogEntry {
  const c = getSupportCard(id);
  return { cardId: c.id, kind: CardKind.SUPPORT, name: c.name, price: c.price };
}

const BY_ID = new Map<string, CatalogEntry>([
  ...CARDS.map((c) => [c.id, vehicle(c.id)] as const),
  ...SUPPORT_CARDS.map((c) => [c.id, support(c.id)] as const),
]);

export const cardCatalog = {
  /** `undefined` = böyle bir kart yok. Çağıran 404 döndürür. */
  find(cardId: string): CatalogEntry | undefined {
    return BY_ID.get(cardId);
  },

  /**
   * Yeni hesabın başlangıç kartları. İstemcideki listeyle aynı yerden
   * geliyor (fiyatı 0 olan kartlar), yani ikisi ayrışamaz.
   */
  starters(): { cardId: string; kind: CardKind }[] {
    return [
      ...STARTER_CARD_IDS.map((cardId) => ({ cardId, kind: CardKind.VEHICLE })),
      ...STARTER_SUPPORT_IDS.map((cardId) => ({ cardId, kind: CardKind.SUPPORT })),
    ];
  },
};
