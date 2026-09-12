import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './order.entity';
import { User } from '../users/user.entity';
import { Product } from '../products/product.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { WalletModule } from '../wallet/wallet.module';
import { ReferralModule } from '../referrals/referral.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order, User, Product]), WalletModule, ReferralModule],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
