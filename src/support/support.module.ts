import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './message.entity';
import { Dispute } from './dispute.entity';
import { SupportService, SupportController, AdminDisputesController } from './support.service';

@Module({
  imports: [TypeOrmModule.forFeature([Message, Dispute])],
  providers: [SupportService],
  controllers: [SupportController, AdminDisputesController],
})
export class SupportModule {}
