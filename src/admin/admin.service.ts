import { Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get, Injectable, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsString } from 'class-validator';
import { User } from '../users/user.entity';
import { Order } from '../orders/order.entity';
import { Booking } from '../bookings/bookings.service';
import { Product } from '../products/product.entity';

// Vérifie que la personne connectée est bien un administrateur MERCA (toi).
// Revérifié en base à chaque appel (pas seulement dans le jeton de connexion),
// pour qu'une suspension ou un retrait de droit admin prenne effet immédiatement.
@Injectable()
class AdminGuard implements CanActivate {
  constructor(@InjectRepository(User) private users: Repository<User>) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = await this.users.findOne({ where: { id: req.user?.userId } });
    if (!user?.isAdmin) throw new ForbiddenException('Accès réservé aux administrateurs MERCA');
    return true;
  }
}

class VerifyRoleDto { @IsString() role: string; }

@Controller('admin')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminController {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Order) private orders: Repository<Order>,
    @InjectRepository(Booking) private bookings: Repository<Booking>,
    @InjectRepository(Product) private products: Repository<Product>,
  ) {}

  @Get('stats')
  async stats() {
    const [totalUsers, totalCommercants, totalLivreurs, totalPros, totalProducts, totalOrders, totalBookings] = await Promise.all([
      this.users.count(),
      this.users.createQueryBuilder('u').where(':role = ANY(u.roles)', { role: 'commercant' }).getCount(),
      this.users.createQueryBuilder('u').where(':role = ANY(u.roles)', { role: 'livreur' }).getCount(),
      this.users.createQueryBuilder('u').where(':role = ANY(u.roles)', { role: 'pro' }).getCount(),
      this.products.count(),
      this.orders.count(),
      this.bookings.count(),
    ]);
    const orderCommission = await this.orders.createQueryBuilder('o').select('COALESCE(SUM(o.commission),0)', 'sum').getRawOne();
    const bookingCommission = await this.bookings.createQueryBuilder('b').select('COALESCE(SUM(b.commission),0)', 'sum').getRawOne();
    return {
      totalUsers, totalCommercants, totalLivreurs, totalPros, totalProducts, totalOrders, totalBookings,
      revenueProducts: Number(orderCommission.sum), revenueServices: Number(bookingCommission.sum),
    };
  }

  @Get('users')
  users_() {
    return this.users.find({ order: { createdAt: 'DESC' }, take: 200 });
  }

  @Post('users/:id/suspend')
  async suspend(@Param('id') id: string) {
    const u = await this.users.findOne({ where: { id } });
    u.isSuspended = !u.isSuspended;
    return this.users.save(u);
  }

  @Post('users/:id/verify')
  async verify(@Param('id') id: string, @Body() dto: VerifyRoleDto) {
    const u = await this.users.findOne({ where: { id } });
    u.verifiedRoles = Array.from(new Set([...(u.verifiedRoles || []), dto.role]));
    return this.users.save(u);
  }
}
