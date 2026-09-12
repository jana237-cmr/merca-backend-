import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking, BookingsService, BookingsController } from './bookings.service';
import { User } from '../users/user.entity';
import { WalletModule } from '../wallet/wallet.module';
import { ReferralModule } from '../referrals/referral.module';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, User]), WalletModule, ReferralModule],
  providers: [BookingsService],
  controllers: [BookingsController],
})
export class BookingsModule {}
