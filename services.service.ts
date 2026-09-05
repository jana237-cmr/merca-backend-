import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository, TypeOrmModule } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Roles, RolesGuard } from '../auth/roles.guard';

const BLOQUE_JOURS = 33;

@Entity('services')
export class ServiceEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() proId: string;
  @Column() name: string;
  @Column('decimal', { precision: 12, scale: 2 }) price: number;
  @Column() domaine: string;
  @Column({ nullable: true }) description: string;
  @Column({ default: true }) dispo: boolean;
  @Column({ nullable: true }) priceLockedUntil: Date;
  @CreateDateColumn() createdAt: Date;
}

class CreateServiceDto { @IsString() name: string; @IsNumber() @Min(1) price: number; @IsString() domaine: string; @IsOptional() @IsString() description?: string; }
class UpdateServiceDto { @IsOptional() @IsNumber() @Min(1) price?: number; @IsOptional() dispo?: boolean; }

@Injectable()
export class ServicesService {
  constructor(@InjectRepository(ServiceEntity) private services: Repository<ServiceEntity>) {}

  listAvailable(domaine?: string) {
    const where: any = { dispo: true };
    if (domaine) where.domaine = domaine;
    return this.services.find({ where, order: { createdAt: 'DESC' } });
  }

  async create(proId: string, dto: CreateServiceDto) {
    const s = this.services.create({ ...dto, proId, priceLockedUntil: new Date(Date.now() + BLOQUE_JOURS * 86400000) });
    return this.services.save(s);
  }

  async update(id: string, proId: string, dto: UpdateServiceDto) {
    const s = await this.services.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Service introuvable');
    if (s.proId !== proId) throw new ForbiddenException("Ce service ne t'appartient pas");
    if (dto.price !== undefined && s.priceLockedUntil && s.priceLockedUntil > new Date()) {
      throw new BadRequestException(`Tarif bloqué jusqu'au ${s.priceLockedUntil.toISOString()}`);
    }
    Object.assign(s, dto);
    if (dto.price !== undefined) s.priceLockedUntil = new Date(Date.now() + BLOQUE_JOURS * 86400000);
    return this.services.save(s);
  }
}

@Controller('services')
export class ServicesController {
  constructor(private services: ServicesService) {}

  @Get() list(@Query('domaine') domaine?: string) { return this.services.listAvailable(domaine); }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('pro')
  create(@Req() req: any, @Body() dto: CreateServiceDto) { return this.services.create(req.user.userId, dto); }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('pro')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateServiceDto) { return this.services.update(id, req.user.userId, dto); }
}

