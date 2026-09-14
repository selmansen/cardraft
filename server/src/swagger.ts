import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';

import { APP_VERSION } from './version.js';

/**
 * OpenAPI şeması — elle değil, koddan üretiliyor.
 *
 * Alan listeleri ve tipler `nest-cli.json`'daki Swagger derleyici eklentisinden
 * geliyor: DTO'ların TypeScript tiplerini ve class-validator kurallarını okuyup
 * şemayı kendi çıkarıyor, ayrıca `introspectComments` sayesinde koddaki
 * açıklama yorumlarını da alıyor. Yani her alana `@ApiProperty` yazmak
 * gerekmiyor — ki gereksiydi, DTO'lar iki kat uzar ve ilk unutulan dekoratörde
 * belge sessizce yanlışa düşerdi.
 *
 * Belgenin elle yazılmayan bir şey olması esas nokta: elle yazılan API
 * belgeleri kodun gerisinde kalır ve gerisinde kaldığı gün, okuyan kişiyi
 * yanlış yönlendirdiği için hiç olmamasından kötüdür.
 */
export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('CarDraft API')
    .setDescription(
      [
        'Araç temalı koleksiyon kart oyununun sunucu API\'si.',
        '',
        '**Başlarken:** `POST /auth/guest` ile misafir oturumu aç, dönen',
        '`accessToken`\'ı yukarıdaki **Authorize** düğmesine yapıştır.',
        '',
        'Uç noktalar varsayılan olarak **kapalıdır**: guard global, açmak için',
        'açıkça `@Public()` yazmak gerekir. Kilit simgesi olmayan uçlar kimlik',
        'doğrulaması istemez.',
        '',
        'Kararların gerekçeleri `server/docs/adr/` altında.',
      ].join('\n'),
    )
    // Sağlık kontrolünün bildirdiğiyle aynı sürüm — bkz. src/version.ts.
    .setVersion(APP_VERSION)
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      // Şemanın adı: @ApiBearerAuth('access-token') ile eşleşmeli.
      'access-token',
    )
    .addTag('Sistem', 'Kimlik doğrulaması istemeyen uçlar')
    .addTag('Kimlik', 'Misafir giriş, kayıt, token yenileme')
    .addTag('Ekonomi', 'Cüzdan ve işlem defteri')
    .addTag('Envanter', 'Koleksiyon ve kart açma')
    .addTag('Maç', 'Maç oturumu ve sunucu tarafı doğrulama')
    .addTag('Cihaz', 'Cihaz kaydı ve push jetonları')
    .build();

  return splitSummaries(SwaggerModule.createDocument(app, config));
}

/**
 * Uzun açıklamayı başlık ve gövdeye ayırır.
 *
 * Swagger eklentisi koddaki yorumun TAMAMINI `summary` alanına koyuyor;
 * `summary` ise arayüzde uç noktanın tek satırlık başlığı. Üç paragraflık bir
 * gerekçe oraya sığmıyor ve liste okunmaz hale geliyor.
 *
 * Çözüm olarak yorumu ikiye ayırmak, aynı metni bir de `@ApiOperation` içine
 * elle yazmaya tercih edildi: ikinci kopya, ilkiyle günün birinde ayrışır ve
 * ayrıştığında hangisinin doğru olduğu belli olmaz. Burada tek kaynak koddaki
 * yorum; bu fonksiyon sadece onu biçimlendiriyor.
 */
function splitSummaries(document: OpenAPIObject): OpenAPIObject {
  for (const methods of Object.values(document.paths)) {
    for (const operation of Object.values(methods)) {
      if (typeof operation !== 'object' || operation === null) continue;
      const op = operation as { summary?: string; description?: string };
      if (!op.summary) continue;

      const [first, ...rest] = op.summary.split(/\n\s*\n/);
      // Başlıktaki satır sonları boşluğa dönüyor: kaynak kodda 80 sütuna
      // sarılmış bir cümle, arayüzde tek satır olmalı.
      op.summary = first.replace(/\s*\n\s*/g, ' ').trim();
      if (rest.length > 0 && !op.description) op.description = rest.join('\n\n').trim();
    }
  }
  return document;
}

/**
 * Swagger arayüzünü `/api/docs`, ham şemayı `/api/docs-json` altına bağlar.
 *
 * Üretimde kapalı: şema, var olan bütün uçları ve gövde biçimlerini tek
 * sayfada listeliyor. Geliştirirken tam olarak istediğimiz şey bu, canlıda
 * ise saldırganın işini kolaylaştırmaktan başka bir işe yaramaz. Kapatmak
 * bir güvenlik önlemi değil (güvenlik guard'larda), gereksiz bilgi
 * vermemek.
 */
export function setupSwagger(app: INestApplication, isProduction: boolean): void {
  if (isProduction) return;

  SwaggerModule.setup('api/docs', app, buildOpenApiDocument(app), {
    jsonDocumentUrl: 'api/docs-json',
    swaggerOptions: {
      // Sayfayı yenileyince token'ın kaybolmaması için: her denemede yeniden
      // yapıştırmak, arayüzü kullanılmaz hale getiren cinsten bir sürtünme.
      persistAuthorization: true,
      docExpansion: 'list',
    },
    customSiteTitle: 'CarDraft API',
  });
}
