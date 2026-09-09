import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { RatingsService } from './ratings.service';

@Controller('ratings')
export class RatingsController {
  constructor(private ratingsService: RatingsService) {}

  @Post()
  async create(@Body() body: { raterId: string; ratedId: string; orderId?: string; rating: number; comment?: string }) {
    return this.ratingsService.create(body);
  }

  @Get(':ratedId')
  async getForUser(@Param('ratedId') ratedId: string) {
    return this.ratingsService.getForUser(ratedId);
  }
               }
