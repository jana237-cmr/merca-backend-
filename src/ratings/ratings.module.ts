import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RatingEntity } from './rating.entity';
import { RatingsService } from './ratings.service';
import { RatingsController } from './ratings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RatingEntity])],
  providers: [RatingsService],
  controllers: [RatingsController],
  exports: [RatingsService],
})
export class RatingsModule {}
