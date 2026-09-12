import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { WalletModule } from '../wallet/wallet.module';
import { ReferralService } from './referral.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), WalletModule],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
