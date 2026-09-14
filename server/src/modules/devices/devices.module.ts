import { Module } from '@nestjs/common';

import { DevicesController } from './devices.controller.js';
import { DevicesService } from './devices.service.js';

@Module({
  controllers: [DevicesController],
  providers: [DevicesService],
  // AuthService girişte cihaz kaydı yapıyor, o yüzden dışa açık.
  exports: [DevicesService],
})
export class DevicesModule {}
