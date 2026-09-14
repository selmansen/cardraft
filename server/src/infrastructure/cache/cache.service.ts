import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

import { TypedConfigService } from '../../config/app-config.module.js';

/**
 * Redis üzerine ince bir "cache-aside" katmanı.
 *
 * Cache-aside deseni: veriyi önce önbellekte ara, yoksa kaynaktan (DB) oku ve
 * önbelleğe yaz. Alternatifi "write-through"du (her yazmada önbelleği de
 * güncelle); onu seçmedik çünkü bu projede okuma/yazma oranı çok okuma
 * ağırlıklı ve write-through her yazma yolunu önbelleğe bağımlı hale
 * getirerek yazma yollarını kırılganlaştırırdı.
 *
 * `wrap` metodunun varlığı bilinçli: onsuz her çağrı yerinde "get → boşsa
 * hesapla → set" üçlüsü tekrarlanırdı. Aynı üç satırın onlarca yerde
 * kopyalanması tam olarak kaçınmak istediğimiz duplikasyon.
 */
@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly client: Redis;

  constructor(config: TypedConfigService) {
    this.client = new Redis({
      host: config.get('REDIS_HOST'),
      port: config.get('REDIS_PORT'),
      // Redis düşerse uygulama komple çökmemeli: önbellek bir hızlandırma
      // katmanı, doğruluk kaynağı değil. Bağlantı hataları loglanıp geçilir.
      maxRetriesPerRequest: 2,
      lazyConnect: false,
    });
    this.client.on('error', (err: Error) => this.logger.warn(`Redis hatası: ${err.message}`));
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length > 0) await this.client.del(...keys);
  }

  /**
   * Sayacı bir artırır ve yeni değeri döndürür; ilk artışta anahtara süre koyar.
   *
   * Hız sınırlama için: `INCR` atomik, yani iki eşzamanlı istek aynı sayıyı
   * okuyup ikisi de "1" yazamaz. Süre YALNIZCA ilk artışta konuyor — her
   * artışta yenilenseydi sürekli istek gönderen bir istemcinin penceresi hiç
   * kapanmaz ve sınır sonsuza kadar sürerdi.
   */
  async increment(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.client.incr(key);
    if (count === 1) await this.client.expire(key, ttlSeconds);
    return count;
  }

  /**
   * "Önbellekte varsa onu ver, yoksa üret + sakla." Önbellek kullanımının
   * tek girişi burası olmalı.
   */
  async wrap<T>(key: string, ttlSeconds: number, produce: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const fresh = await produce();
    await this.set(key, fresh, ttlSeconds);
    return fresh;
  }

  /** Ham istemci — sayaç/kilit gibi JSON olmayan işler için (rate limit vb.). */
  get raw(): Redis {
    return this.client;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }
}
