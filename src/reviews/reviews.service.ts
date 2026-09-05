import { Body, Controller, Get, Injectable, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

@Entity('reviews')
export class Review {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() authorId: string;
  @Column() targetUserId: string; // marchand, pro, ou livreur noté
  @Column({ nullable: true }) refOrderId: string;
  @Column({ nullable: true }) refBookingId: string;
  @Column() rating: number;
  @Column({ nullable: true }) comment: string;
  @CreateDateColumn() createdAt: Date;
}

class CreateReviewDto {
  @IsUUID() targetUserId: string;
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() comment?: string;
  @IsOptional() @IsUUID() refOrderId?: string;
  @IsOptional() @IsUUID() refBookingId?: string;
}

@Injectable()
export class ReviewsService {
  constructor(@InjectRepository(Review) private reviews: Repository<Review>) {}

  async create(authorId: string, dto: CreateReviewDto) {
    const r = this.reviews.create({ ...dto, authorId });
    return this.reviews.save(r);
  }

  async forTarget(targetUserId: string) {
    const list = await this.reviews.find({ where: { targetUserId }, order: { createdAt: 'DESC' } });
    const avg = list.length ? Math.round((list.reduce((s, r) => s + r.rating, 0) / list.length) * 10) / 10 : null;
    return { avg, count: list.length, reviews: list };
  }
}

@Controller('reviews')
export class ReviewsController {
  constructor(private reviews: ReviewsService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Req() req: any, @Body() dto: CreateReviewDto) { return this.reviews.create(req.user.userId, dto); }

  @Get('target/:userId')
  forTarget(@Param('userId') userId: string) { return this.reviews.forTarget(userId); }
}
