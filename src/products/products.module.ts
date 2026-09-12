import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from './product.entity';
import { SearchLogEntity } from '../search-logs/search-log.entity';
import { User } from '../users/user.entity';
import { AuthModule } from '../auth/auth.module';
import { ProductsService, ProductsController } from './products.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product, SearchLogEntity, User]), AuthModule],
  providers: [ProductsService],
  controllers: [ProductsController],
})
export class ProductsModule {}
