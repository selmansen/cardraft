import { Controller, Get } from '@nestjs/common';

import { Public } from './common/decorators/auth.decorators.js';
import { AppService, type HealthStatus } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Sağlık kontrolü — bilerek @Public.
   *
   * Bu ucu çağıran şey bir oyuncu değil: CI, Docker sağlık kontrolü ve
   * ileride AWS yük dengeleyici. Token isteyen bir sağlık kontrolü, "sunucu
   * ayakta mı" sorusuna "önce giriş yap" diye cevap verir; dengeleyici de
   * sağlıklı bir sunucuyu ölü sanıp trafikten düşürür.
   *
   * Sızdırdığı tek bilgi sürüm numarası ve ayakta kalma süresi — ikisi de
   * saldırgana işe yarar bir şey vermiyor, operasyona ise çok şey veriyor.
   */
  @Public()
  @Get('health')
  health(): HealthStatus {
    return this.appService.health();
  }
}
