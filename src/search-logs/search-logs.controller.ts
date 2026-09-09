import { Body, Controller, Post } from '@nestjs/common';
import { SearchLogsService } from './search-logs.service';

@Controller('search-logs')
export class SearchLogsController {
  constructor(private searchLogsService: SearchLogsService) {}

  @Post()
  async log(@Body() body: { userId?: string; query: string; hasResults: boolean }) {
    return this.searchLogsService.log(body);
  }
              }
