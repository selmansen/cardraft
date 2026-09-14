import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Maç açarken: hangi zorluk ve hangi kadro. Kadronun kartlarına gerçekten
 *  sahip olunup olunmadığı sunucuda doğrulanıyor. */
export class OpenMatchDto {
  @IsIn(['easy', 'normal', 'hard'])
  difficulty!: 'easy' | 'normal' | 'hard';

  /** Oyuncunun bu maç için seçtiği araçlar. Seçim istemcinin, ama her
   *  kimliğin gerçekten sahip olunan bir karta karşılık geldiği sunucuda
   *  doğrulanıyor (MatchService.open). */
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  vehicleCardIds!: string[];

  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  supportCardIds!: string[];
}

class PlayerActionDto {
  @IsIn(['PLAY', 'PLAY_SUPPORT', 'ATTACK'])
  type!: 'PLAY' | 'PLAY_SUPPORT' | 'ATTACK';

  @IsOptional()
  @IsInt()
  @Min(0)
  handIndex?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  scrapUid?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  targetUid?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  attackerUid?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  target?: string;
}

class PlayerTurnDto {
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PlayerActionDto)
  actions!: PlayerActionDto[];
}

/**
 * Maç sonucu gönderimi.
 *
 * Dikkat: burada "kazandım" diye bir alan YOK. İstemci yalnızca ne yaptığını
 * gönderiyor; kimin kazandığına sunucu kendi hesabıyla karar veriyor.
 */
export class SubmitMatchDto {
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => PlayerTurnDto)
  turns!: PlayerTurnDto[];
}
