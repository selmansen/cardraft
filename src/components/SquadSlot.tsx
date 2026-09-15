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
          ? { backgroundColor: '#FFE4EE', borderColor: colors.bubble }
          : { backgroundColor: tint!.art, borderColor: tint!.border },
      ]}
      onPress={onRemove}
      disabled={!onRemove}
    >
      {support ? (
        <MaterialCommunityIcons name={icon!} size={18} color={colors.bubble} />
      ) : (
        <Image source={carImage(cardId)} style={styles.image} resizeMode="cover" />
      )}
      {onRemove && (
        <View style={styles.remove}>
          <MaterialCommunityIcons name="minus" size={10} color="#FFFFFF" />
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
  remove: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 17,
    height: 17,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.surface,
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
