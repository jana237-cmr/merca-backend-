import { BadRequestException, Body, Controller, ForbiddenException, Get, Injectable, NotFoundException, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Product } from './product.entity';
import { SearchLogEntity } from '../search-logs/search-log.entity';
import { User } from '../users/user.entity';
import { Roles, RolesGuard } from '../auth/roles.guard';

const BLOQUE_JOURS = 50;
// Paliers de rayon de recherche (en km) - si rien n'est trouvé dans le premier
// rayon, on élargit automatiquement au suivant, jusqu'à chercher partout.
const RADII_KM = [5, 15, 50, null];

class CreateProductDto { @IsString() name: string; @IsNumber() @Min(1) price: number; @IsNumber() @Min(0) stock: number; @IsOptional() @IsString() category?: string; @IsOptional() @IsString() city?: string; @IsOptional() @IsString() description?: string; @IsOptional() @IsString() img?: string; @IsOptional() @IsString() shopName?: string; }
class UpdateProductDto { @IsOptional() @IsNumber() @Min(1) price?: number; @IsOptional() @IsNumber() @Min(0) stock?: number; }

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product) private products: Repository<Product>,
    @InjectRepository(SearchLogEntity) private searchLogs: Repository<SearchLogEntity>,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

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

  // ---- Recherche intelligente ----
  // - Tolère les fautes de frappe (similarité de texte, extension pg_trgm)
  // - Priorise les produits des commerçants les plus proches du client
  // - Élargit automatiquement le rayon de recherche si rien n'est trouvé près de lui
  async smartSearch(query: string, userId?: string, lat?: number, lon?: number) {
    // Si on a un compte connecté mais pas de coordonnées fournies, on récupère
    // sa position déjà enregistrée (GPS ou adresse tapée) côté serveur.
    if (userId && (lat == null || lon == null)) {
      const me = await this.users.findOne({ where: { id: userId } });
      if (me?.latitude != null && me?.longitude != null) { lat = me.latitude; lon = me.longitude; }
    }

    let results: any[] = [];
    let radiusUsed: number | null = null;

    for (const radius of RADII_KM) {
      const qb = this.products
        .createQueryBuilder('p')
        .where('(p.name ILIKE :like OR similarity(p.name, :query) > 0.25)', { like: `%${query}%`, query })
        .addSelect('similarity(p.name, :query)', 'score');

      if (lat != null && lon != null && radius != null) {
        qb.leftJoin('users', 'u', 'u.id = p.merchant_id')
          .andWhere(
            `(6371 * acos(LEAST(1, GREATEST(-1,
              cos(radians(:lat)) * cos(radians(u.latitude)) * cos(radians(u.longitude) - radians(:lon))
              + sin(radians(:lat)) * sin(radians(u.latitude))
            )))) <= :radius`,
            { lat, lon, radius },
          );
      }

      qb.orderBy('score', 'DESC').addOrderBy('p.created_at', 'DESC').limit(30);
      results = await qb.getMany();
      if (results.length > 0 || radius === null) { radiusUsed = radius; break; }
    }

    // Journalise la recherche (pour analyser plus tard les tendances et
    // affiner encore la pertinence) - un échec de journalisation ne doit
    // jamais empêcher de répondre au client.
    this.searchLogs.save(this.searchLogs.create({ userId: userId || null, query, hasResults: results.length > 0 })).catch(() => {});

    return { results, radiusUsedKm: radiusUsed };
  }
}

@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService, private jwt: JwtService) {}

  @Get()
  list(@Query('city') city?: string, @Query('category') category?: string) {
    return this.products.list(city, category);
  }

  // Pas de @UseGuards ici : ça casserait la recherche pour les invités (accès
  // limité mais autorisé) - on lit le compte manuellement si présent,
  // sans jamais bloquer un utilisateur non connecté.
  @Get('search')
  async search(@Req() req: any, @Query('q') q: string, @Query('lat') lat?: string, @Query('lon') lon?: string) {
    if (!q || !q.trim()) return { results: [], radiusUsedKm: null };
    const auth = req.headers?.authorization;
    let userId: string | undefined;
    if (auth?.startsWith('Bearer ')) {
      try { userId = this.jwt.verify(auth.slice(7))?.sub; }
      catch (e) { /* pas de session valide - recherche en mode invité */ }
    }
    return this.products.smartSearch(q.trim(), userId, lat ? Number(lat) : undefined, lon ? Number(lon) : undefined);
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
