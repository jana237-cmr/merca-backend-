import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking, BookingsService, BookingsController } from './bookings.service';
import { User } from '../users/user.entity';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [TypeOrmModule.forFeature([Booking, User]), WalletModule],
  providers: [BookingsService],
  controllers: [BookingsController],
})
export class BookingsModule {}
