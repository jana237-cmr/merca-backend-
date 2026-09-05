import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ServiceEntity, ServicesService, ServicesController } from './services.service';

@Module({
  imports: [TypeOrmModule.forFeature([ServiceEntity])],
  providers: [ServicesService],
  controllers: [ServicesController],
  exports: [TypeOrmModule],
})
export class ServicesModule {}
