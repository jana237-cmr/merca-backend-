import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SearchLogEntity } from './search-log.entity';

@Injectable()
export class SearchLogsService {
  constructor(
    @InjectRepository(SearchLogEntity)
    private searchLogsRepo: Repository<SearchLogEntity>,
  ) {}

  async log(data: Partial<SearchLogEntity>) {
    const entry = this.searchLogsRepo.create(data);
    return this.searchLogsRepo.save(entry);
  }
}
