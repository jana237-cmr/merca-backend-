import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Message } from './message.entity';
import { Dispute } from './dispute.entity';
import { User } from '../users/user.entity';
import { SupportService, SupportController, AdminDisputesController } from './support.service';

@Module({
  // User est nécessaire ici car AdminGuard (utilisé par AdminDisputesController)
  // a besoin de vérifier le statut administrateur directement en base.
  imports: [TypeOrmModule.forFeature([Message, Dispute, User])],
  providers: [SupportService],
  controllers: [SupportController, AdminDisputesController],
})
export class SupportModule {}
