import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { WalletModule } from './wallet/wallet.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { ServicesModule } from './services/services.module';
import { BookingsModule } from './bookings/bookings.module';
import { ReviewsModule } from './reviews/reviews.module';
import { SearchLogsModule } from './search-logs/search-logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
      namingStrategy: new SnakeNamingStrategy(),
    }),
    AuthModule,
    UsersModule,
    WalletModule,
    OrdersModule,
    ProductsModule,
    ServicesModule,
    BookingsModule,
    ReviewsModule,
    SearchLogsModule,
  ],
})
export class AppModule {}
