import { Module } from '@nestjs/common';
import { ArkasodharaAdminController, ContactController } from './arkasodhara.controller';
import { ArkasodharaService } from './arkasodhara.service';

@Module({
  controllers: [ContactController, ArkasodharaAdminController],
  providers: [ArkasodharaService],
})
export class ArkasodharaModule {}
