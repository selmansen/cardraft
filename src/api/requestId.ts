/**
 * Tekrar koruması için kimlik üretir (UUID v4 biçiminde).
 *
 * `Math.random` kullanılıyor ve bu BURADA kabul edilebilir — `installationId`
 * durumundan farkı önemli: o değer misafir hesabın fiili giriş anahtarıydı,
 * yani tahmin edilebilir olması başkasının hesabına girmek demekti ve o
 * yüzden üretimi sunucuya bırakıldı. Bunun tek işi ise aynı kullanıcının
 * kendi istekleri arasında çakışmamak; kimse kimsenin kimliğini tahmin
 * ederek bir şey kazanamıyor (benzersizlik zaten kullanıcı başına).
 *
 * React Native'de `crypto.randomUUID` yok; gerçek bir kriptografik üreteç
 * için `expo-crypto` eklemek gerekirdi — buradaki iş için gereksiz bir
 * bağımlılık.
 */
export function newRequestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
