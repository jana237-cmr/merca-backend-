import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Injectable, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsDateString, IsNumber, IsString, IsUUID, Min } from 'class-validator';
import { WalletService } from '../wallet/wallet.service';

const FRAIS = 0.033;

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() clientId: string;
  @Column() serviceId: string;
  @Column() proId: string;
  @Column() slotAt: Date;
  @Column('decimal', { precision: 12, scale: 2 }) price: number;
  @Column('decimal', { precision: 12, scale: 2 }) commission: number;
  @Column('decimal', { precision: 12, scale: 2 }) total: number;
  @Column({ default: 'Demande envoyée' }) status: string;
  @Column({ unique: true }) bookingCode: string;
  @Column({ unique: true }) idempotencyKey: string;
  @CreateDateColumn() createdAt: Date;
}

class CreateBookingDto {
  @IsUUID() serviceId: string; @IsUUID() proId: string;
  @IsNumber() @Min(1) servicePrice: number;
  @IsDateString() slotAt: string;
  @IsString() idempotencyKey: string;
}

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking) private bookings: Repository<Booking>,
    private wallet: WalletService,
  ) {}

  private async genCode(): Promise<string> {
    for (let i = 0; i < 20; i++) {
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      if (!(await this.bookings.findOne({ where: { bookingCode: code } }))) return code;
    }
    throw new Error('Impossible de générer un code réservation unique');
  }

  async create(clientId: string, dto: CreateBookingDto) {
    const existing = await this.bookings.findOne({ where: { idempotencyKey: dto.idempotencyKey } });
    if (existing) return existing;

    const commission = Math.round(dto.servicePrice * FRAIS);
    const total = dto.servicePrice + commission;
    const bookingCode = await this.genCode();

    await this.wallet.debit(clientId, total, 'booking', dto.idempotencyKey);

    const b = this.bookings.create({ clientId, serviceId: dto.serviceId, proId: dto.proId, slotAt: new Date(dto.slotAt), price: dto.servicePrice, commission, total, bookingCode, idempotencyKey: dto.idempotencyKey });
    return this.bookings.save(b);
  }

  async confirm(id: string, proId: string) {
    const b = await this.bookings.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Réservation introuvable');
    if (b.proId !== proId) throw new ForbiddenException("Cette réservation ne t'appartient pas");
    if (b.status !== 'Demande envoyée') throw new ConflictException('Déjà traitée');
    b.status = 'Confirmée';
    return this.bookings.save(b);
  }

  async complete(id: string, proId: string) {
    const b = await this.bookings.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Réservation introuvable');
    if (b.proId !== proId) throw new ForbiddenException("Cette réservation ne t'appartient pas");
    if (b.status !== 'Confirmée') throw new BadRequestException('La réservation doit être confirmée avant');
    await this.wallet.credit(proId, Number(b.price), 'payout', `payout-booking-${b.id}`, b.id);
    b.status = 'Terminée';
    return this.bookings.save(b);
  }

  async cancel(id: string, clientId: string) {
    const b = await this.bookings.findOne({ where: { id } });
    if (!b) throw new NotFoundException('Réservation introuvable');
    if (b.clientId !== clientId) throw new ForbiddenException("Cette réservation ne t'appartient pas");
    if (b.status !== 'Demande envoyée') throw new BadRequestException('Impossible d\'annuler après confirmation');
    await this.wallet.credit(clientId, Number(b.total), 'refund', `refund-booking-${b.id}`, b.id);
    b.status = 'Annulée';
    return this.bookings.save(b);
  }
}

@Controller('bookings')
@UseGuards(AuthGuard('jwt'))
export class BookingsController {
  constructor(private bookings: BookingsService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateBookingDto) { return this.bookings.create(req.user.userId, dto); }

  @Post(':id/confirm')
  confirm(@Req() req: any, @Param('id') id: string) { return this.bookings.confirm(id, req.user.userId); }

  @Post(':id/complete')
  complete(@Req() req: any, @Param('id') id: string) { return this.bookings.complete(id, req.user.userId); }

  @Post(':id/cancel')
  cancel(@Req() req: any, @Param('id') id: string) { return this.bookings.cancel(id, req.user.userId); }
}
