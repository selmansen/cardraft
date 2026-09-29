import { ArrayMaxSize, IsArray, IsString } from 'class-validator';

import { LOADOUT_TOTAL } from '../../../game-engine/game/loadoutRules.js';

export class SaveLoadoutDto {
  /**
   * Üst sınır DTO'da, asıl kural serviste.
   *
   * Buradaki tek iş kötü niyetli bir isteğin binlerce kimlikle gelip sahiplik
   * sorgusunu şişirmesini engellemek. "En az 3 araç, toplam 8" kuralı
   * motordan geliyor ve serviste uygulanıyor — iki yerde yazılsaydı biri
   * geride kalırdı.
   */
  @IsArray()
  @ArrayMaxSize(LOADOUT_TOTAL)
  @IsString({ each: true })
  vehicleCardIds!: string[];

  @IsArray()
  @ArrayMaxSize(LOADOUT_TOTAL)
  @IsString({ each: true })
  supportCardIds!: string[];
}
