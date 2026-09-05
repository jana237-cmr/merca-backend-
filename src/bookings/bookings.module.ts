import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Booking, BookingsService, BookingsController } from './bookings.service';
import { WalletModule } from '../wallet/wallet.module';

@Module({
  imports: [TypeOrmModule.forFeature([Booking]), WalletModule],
  providers: [BookingsService],
  controllers: [BookingsController],
})
export class BookingsModule {}
