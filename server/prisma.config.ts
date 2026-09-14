import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 artık şemayı varsayılan konumda aramıyor ve .env'i kendiliğinden
 * yüklemiyor; ikisi de burada açıkça belirtiliyor.
 *
 * `schema` bir DOSYAYI değil KLASÖRÜ gösteriyor — kritik fark: dosya
 * gösterilirse Prisma sadece o dosyayı okur ve diğer domain dosyalarındaki
 * modeller sessizce üretilen istemciye girmez (hata da vermez). Klasör
 * gösterildiğinde içindeki tüm .prisma dosyaları tek şema gibi birleşiyor,
 * bizim auth/device ayrımımızın çalışma şekli bu.
 */
export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
  },
  // Sadece CLI (migrate/studio) bu URL'yi kullanır. Uygulamanın çalışma
  // zamanındaki bağlantısı ayrı: PrismaService içinde driver adapter'a
  // veriliyor. Aynı .env değişkeninden besleniyorlar ama yolları farklı.
  datasource: {
    url: env('DATABASE_URL'),
  },
});
