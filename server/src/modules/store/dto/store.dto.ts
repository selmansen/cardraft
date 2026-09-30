import { IsIn, IsOptional, IsUUID } from 'class-validator';

export class OpenPackDto {
  /**
   * Hangi keseyle ödenecek. Verilmezse jant — coin sonradan eklendi ve eski
   * istemciler bu alanı göndermiyor; varsayılanı jant yapmak o istemcilerin
   * davranışını aynen koruyor.
   *
   * Kese İSTEMCİDEN geliyor ama fiyat gelmiyor: sunucu hangi kesede ne
   * istendiğini kendi tablosundan okuyor (bkz. packPrice). İstemcinin
   * söyleyebildiği tek şey "şununla ödemek istiyorum".
   */
  @IsOptional()
  @IsIn(['rim', 'coin'], { message: 'currency yalnızca rim ya da coin olabilir' })
  currency?: 'rim' | 'coin';

  /**
   * İstemcinin ürettiği tekrar koruması.
   *
   * Zorunlu ve istemciden geliyor çünkü korunması gereken şey tam olarak
   * "aynı isteğin ikinci kez gönderilmesi": mobil ağda cevap kaybolur,
   * istemci tekrar dener. Sunucu kendi kimliğini üretseydi her deneme yeni
   * bir açılış olurdu — oyuncudan iki kez para düşer, iki kart çekilirdi.
   *
   * UUID şartı bilinçli: tahmin edilemez ve çakışmaz. Sıra numarası
   * olsaydı bir oyuncunun kimliği bir başkasınınkiyle çakışabilirdi
   * (benzersizlik kullanıcı başına ama yine de öngörülebilirlik istemiyoruz).
   */
  @IsUUID('4', { message: 'requestId bir UUID olmalı' })
  requestId!: string;
}
