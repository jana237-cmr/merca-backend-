import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Product } from './product.entity';
import { Roles, RolesGuard } from '../auth/roles.guard';

const BLOQUE_JOURS = 33;

class CreateProductDto { @IsString() name: string; @IsNumber() @Min(1) price: number; @IsNumber() @Min(0) stock: number; @IsOptional() @IsString() category?: string; @IsOptional() @IsString() city?: string; }
class UpdateProductDto { @IsOptional() @IsNumber() @Min(1) price?: number; @IsOptional() @IsNumber() @Min(0) stock?: number; }

@Injectable()
export class ProductsService {
  constructor(@InjectRepository(Product) private products: Repository<Product>) {}

  list(city?: string, category?: string) {
    const where: any = {};
    if (city) where.city = city;
    if (category) where.category = category;
    return this.products.find({ where, order: { createdAt: 'DESC' } });
  }

  async create(merchantId: string, dto: CreateProductDto) {
    const p = this.products.create({ ...dto, merchantId, priceLockedUntil: new Date(Date.now() + BLOQUE_JOURS * 86400000) });
    return this.products.save(p);
  }

  async update(id: string, merchantId: string, dto: UpdateProductDto) {
    const p = await this.products.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Produit introuvable');
    if (p.merchantId !== merchantId) throw new ForbiddenException("Ce produit ne t'appartient pas");
    if (dto.price !== undefined && p.priceLockedUntil && p.priceLockedUntil > new Date()) {
      throw new BadRequestException(`Prix bloqué jusqu'au ${p.priceLockedUntil.toISOString()}`);
    }
    Object.assign(p, dto);
    if (dto.price !== undefined) p.priceLockedUntil = new Date(Date.now() + BLOQUE_JOURS * 86400000);
    return this.products.save(p);
  }
}

@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Get()
  list(@Query('city') city?: string, @Query('category') category?: string) {
    return this.products.list(city, category);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('commercant')
  create(@Req() req: any, @Body() dto: CreateProductDto) {
    return this.products.create(req.user.userId, dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard) @Roles('commercant')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, req.user.userId, dto);
  }
}
