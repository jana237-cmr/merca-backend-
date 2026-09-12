import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Order } from '../orders/order.entity';
import { Booking } from '../bookings/bookings.service';

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
  constructor(
    @InjectRepository(Review) private reviews: Repository<Review>,
    @InjectRepository(Order) private orders: Repository<Order>,
    @InjectRepository(Booking) private bookings: Repository<Booking>,
  ) {}

  async create(authorId: string, dto: CreateReviewDto) {
    // Un avis doit toujours pointer vers une vraie commande OU une vraie
    // réservation - impossible de laisser un avis "dans le vide".
    if (!dto.refOrderId && !dto.refBookingId) {
      throw new BadRequestException("Un avis doit être lié à une commande ou une réservation");
    }
    if (dto.targetUserId === authorId) {
      throw new BadRequestException("Impossible de te noter toi-même");
    }

    if (dto.refOrderId) {
      const order = await this.orders.findOne({ where: { id: dto.refOrderId } });
      if (!order) throw new BadRequestException("Commande introuvable");
      if (order.buyerId !== authorId) throw new ForbiddenException("Cette commande ne t'appartient pas");
      if (order.status !== 'Confirmée') throw new BadRequestException("La commande doit être confirmée avant de laisser un avis");
      if (order.merchantId !== dto.targetUserId && order.courierId !== dto.targetUserId) {
        throw new BadRequestException("Cette personne n'est pas liée à cette commande");
      }
    }

    if (dto.refBookingId) {
      const booking = await this.bookings.findOne({ where: { id: dto.refBookingId } });
      if (!booking) throw new BadRequestException("Réservation introuvable");
      if (booking.clientId !== authorId) throw new ForbiddenException("Cette réservation ne t'appartient pas");
      if (booking.status !== 'Terminée') throw new BadRequestException("La réservation doit être terminée avant de laisser un avis");
      if (booking.proId !== dto.targetUserId) throw new BadRequestException("Cette personne n'est pas liée à cette réservation");
    }

    // Un seul avis par transaction et par personne notée (évite le spam de
    // plusieurs avis pour la même commande/réservation).
    const existing = await this.reviews.findOne({
      where: dto.refOrderId
        ? { authorId, targetUserId: dto.targetUserId, refOrderId: dto.refOrderId }
        : { authorId, targetUserId: dto.targetUserId, refBookingId: dto.refBookingId },
    });
    if (existing) throw new BadRequestException("Tu as déjà laissé un avis pour cette transaction");

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
