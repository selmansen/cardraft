import { SetMetadata } from '@nestjs/common';

export const ACCOUNT_REQUIRED_KEY = 'accountRequired';

/**
 * Bu uç bağlı bir hesap istiyor — misafir çağıramaz.
 *
 * `@Public()`'in tersi değil: misafirin de geçerli bir oturumu var, sadece
 * hesabı bağlı değil. Ayrımı görünür kılmak için ayrı bir dekoratör;
 * "kimlik doğrulanmış mı" ile "hesap bağlı mı" iki farklı soru.
 */
export const AccountRequired = () => SetMetadata(ACCOUNT_REQUIRED_KEY, true);
