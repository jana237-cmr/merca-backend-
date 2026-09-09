import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchLogEntity } from './search-log.entity';
import { SearchLogsService } from './search-logs.service';
import { SearchLogsController } from './search-logs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SearchLogEntity])],
  providers: [SearchLogsService],
  controllers: [SearchLogsController],
})
export class SearchLogsModule {}
