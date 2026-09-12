import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Review, ReviewsService, ReviewsController } from './reviews.service';
import { Order } from '../orders/order.entity';
import { Booking } from '../bookings/bookings.service';

@Module({
  imports: [TypeOrmModule.forFeature([Review, Order, Booking])],
  providers: [ReviewsService],
  controllers: [ReviewsController],
})
export class ReviewsModule {}
