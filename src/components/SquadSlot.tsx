import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, rarity } from '@/constants/theme';
import { getCard } from '@/data/cards';
import { carImage } from '@/data/carImages';
import { getSupportCard } from '@/data/supportCards';
import { SUPPORT_ICON } from '@/data/supportIcons';

/**
 * Kadrodaki tek bir kartın küçük gösterimi.
 *
 * Oyna ekranı ve Garaj aynı şeridi gösteriyor; ayrı ayrı yazılınca biri
 * güncellenip diğeri geride kalıyordu — nitekim ikisinde de kart GÖRSELİ
 * yoktu, sadece nadirlik rengi vardı ve oyuncu hangi aracı seçtiğini
 * göremiyordu.
 *
 * Bu boyutta stat okunmuyor, o yüzden gösterilmiyor: taşınan bilgi "hangi
 * araç" (görsel) ve "ne kadar iyi" (nadirlik kenarı). Ayrıntı için kart
 * detayı var.
 */
export function SquadSlot({
  cardId,
  kind = 'vehicle',
  onRemove,
}: {
  cardId: string;
  kind?: 'vehicle' | 'support';
  /** Verilirse köşede çıkarma rozeti çıkar ve dokunma onu çağırır. */
  onRemove?: () => void;
}) {
  const support = kind === 'support';
  const tint = support ? null : rarity[getCard(cardId).rarity];
  const icon = support ? SUPPORT_ICON[getSupportCard(cardId).kind] : null;

  return (
    <Pressable
      style={[
        styles.slot,
        support
          ? { backgroundColor: colors.grapeSoft, borderColor: colors.grape }
          : { backgroundColor: tint!.art, borderColor: tint!.border },
      ]}
      onPress={onRemove}
      disabled={!onRemove}
    >
      {support ? (
        <MaterialCommunityIcons name={icon!} size={18} color={colors.grapeInk} />
      ) : (
        <Image source={carImage(cardId)} style={styles.image} resizeMode="cover" />
      )}
      {/* Çıkarma işareti kartın TAM ORTASINDA ve soluk.
          Köşedeki kırmızı rozet, kartın kendisinden daha çok dikkat çekiyordu
          ve kadro şeridi bir "sil" düğmeleri dizisi gibi görünüyordu. Ortada
          ve saydam olunca kartın üstünde bir eylem ipucu olarak duruyor. */}
      {onRemove && (
        <View style={styles.removeOverlay}>
          <View style={styles.removeCircle}>
            <MaterialCommunityIcons name="minus" size={14} color="#FFFFFF" />
          </View>
        </View>
      )}
    </Pressable>
  );
}

/** Boş yuva — kadro eksikken kaç kart kaldığını görünür kılıyor. */
export function EmptySlot({ label }: { label?: string }) {
  return (
    <View style={styles.empty}>
      {label ? (
        <Text style={styles.emptyText}>{label}</Text>
      ) : (
        <MaterialCommunityIcons name="plus" size={16} color={colors.textFaint} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    width: 42,
    height: 56,
    borderRadius: 9,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
  removeOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(240,74,71,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    width: 42,
    height: 56,
    borderRadius: 9,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontFamily: font.bodyBold, fontSize: 14, color: colors.textFaint },
});
