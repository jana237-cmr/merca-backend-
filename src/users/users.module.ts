import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UsersService, UsersController } from './users.service';
import { GeocodingModule } from '../geocoding/geocoding.module';

@Module({
  imports: [TypeOrmModule.forFeature([User]), GeocodingModule],
  providers: [UsersService],
  controllers: [UsersController],
})
export class UsersModule {}
