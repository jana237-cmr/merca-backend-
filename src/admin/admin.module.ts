import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/user.entity';
import { Order } from '../orders/order.entity';
import { Booking } from '../bookings/bookings.service';
import { Product } from '../products/product.entity';
import { AdminController } from './admin.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Order, Booking, Product])],
  controllers: [AdminController],
})
export class AdminModule {}
