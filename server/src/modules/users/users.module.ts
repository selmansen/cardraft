import { Module } from '@nestjs/common';

import { UsersService } from './users.service.js';

@Module({
  providers: [UsersService],
  // Sadece servisi dışa açıyoruz. Auth modülü UsersService'i kullanacak ama
  // kullanıcı tablosuna doğrudan erişmeyecek — veri erişimi bu modülün
  // sorumluluğunda kalıyor (kapsülleme).
  exports: [UsersService],
})
export class UsersModule {}
