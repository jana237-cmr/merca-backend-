import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { AuthModule } from './auth/auth.module';
import { WalletModule } from './wallet/wallet.module';
import { OrdersModule } from './orders/orders.module';
import { ProductsModule } from './products/products.module';
import { ServicesModule } from './services/services.module';
import { BookingsModule } from './bookings/bookings.module';
import { ReviewsModule } from './reviews/reviews.module';

@Module({
  imports: [
    // ConfigModule = lit les variables d'environnement (.env) comme le mot de
    // passe de la base de données, sans les écrire en clair dans le code
    ConfigModule.forRoot({ isGlobal: true }),
    // TypeOrmModule = connecte le serveur à la base de données PostgreSQL et
    // décrit chaque "table" (entity) sous forme de classe TypeScript
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production', // en production, utiliser les migrations SQL du dossier /migrations à la place
      // IMPORTANT (bug corrigé) : sans ceci, TypeORM nomme les colonnes en
      // camelCase (ex: merchantId) alors que migrations/001_init.sql utilise
      // le snake_case (ex: merchant_id) — les deux ne correspondaient pas.
      // Cette stratégie force les entités à utiliser le même style que le SQL.
      namingStrategy: new SnakeNamingStrategy(),
    }),
    AuthModule,
    WalletModule,
    OrdersModule,
    ProductsModule,
    ServicesModule,
    BookingsModule,
    ReviewsModule,
  ],
})
export class AppModule {}
