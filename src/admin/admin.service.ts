import { BadRequestException, Body, CanActivate, Controller, ExecutionContext, ForbiddenException, Get, Injectable, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsNumber, IsString } from 'class-validator';
import { User } from '../users/user.entity';
import { Order } from '../orders/order.entity';
import { Booking } from '../bookings/bookings.service';
import { Product } from '../products/product.entity';
import { Wallet } from '../wallet/wallet.entity';
import { WalletService } from '../wallet/wallet.service';

// Vérifie que la personne connectée est bien un administrateur MERCA (toi).
// Revérifié en base à chaque appel (pas seulement dans le jeton de connexion),
// pour qu'une suspension ou un retrait de droit admin prenne effet immédiatement.
// EN PLUS : exige un second mot de passe séparé (ADMIN_PASSWORD), différent
// du compte lui-même - même si quelqu'un a accès à ton téléphone déverrouillé,
// il ne peut pas ouvrir l'administration sans connaître ce mot de passe.
@Injectable()
class AdminGuard implements CanActivate {
  constructor(@InjectRepository(User) private users: Repository<User>) {}
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const user = await this.users.findOne({ where: { id: req.user?.userId } });
    if (!user?.isAdmin) throw new ForbiddenException('Accès réservé aux administrateurs MERCA');
    // .trim() des deux côtés : un espace ou retour à la ligne accidentel
    // (fréquent en copiant-collant une valeur dans un formulaire) ne doit
    // jamais bloquer silencieusement l'accès sans qu'on comprenne pourquoi.
    const configured = process.env.MERCA_ADMIN_SECRET?.trim();
    if (!configured) {
      throw new ForbiddenException("La variable MERCA_ADMIN_SECRET n'est pas configurée sur le serveur (pas encore ajoutée, ou le service n'a pas redémarré depuis)");
    }
    const provided = (req.headers['x-admin-password'] || '').toString().trim();
    if (provided !== configured) throw new ForbiddenException('Mot de passe administrateur incorrect');
    return true;
  }
}

class VerifyRoleDto { @IsString() role: string; }
class WalletAdjustDto { @IsNumber() amount: number; } // positif = crédite, négatif = débite

@Controller('admin')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminController {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Order) private orders: Repository<Order>,
    @InjectRepository(Booking) private bookings: Repository<Booking>,
    @InjectRepository(Product) private products: Repository<Product>,
    @InjectRepository(Wallet) private wallets: Repository<Wallet>,
    private wallet: WalletService,
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

  // Aucune limite : tous les comptes, sans pagination artificielle.
  @Get('users')
  users_() {
    return this.users.find({ order: { createdAt: 'DESC' } });
  }

  // Vue complète d'un compte : profil + solde réel + tout son activité
  @Get('users/:id')
  async userDetail(@Param('id') id: string) {
    const u = await this.users.findOne({ where: { id } });
    if (!u) throw new NotFoundException('Compte introuvable');
    const [wallet, boughtOrders, soldOrders, deliveries, myProducts, myBookingsAsClient, myBookingsAsPro] = await Promise.all([
      this.wallets.findOne({ where: { userId: id } }),
      this.orders.count({ where: { buyerId: id } }),
      this.orders.count({ where: { merchantId: id } }),
      this.orders.count({ where: { courierId: id } }),
      this.products.count({ where: { merchantId: id } }),
      this.bookings.count({ where: { clientId: id } }),
      this.bookings.count({ where: { proId: id } }),
    ]);
    return {
      user: u,
      walletBalance: wallet ? Number(wallet.balance) : null,
      boughtOrders, soldOrders, deliveries, myProducts, myBookingsAsClient, myBookingsAsPro,
    };
  }

  @Post('users/:id/suspend')
  async suspend(@Req() req: any, @Param('id') id: string) {
    if (id === req.user.userId) {
      throw new BadRequestException('Impossible de suspendre ton propre compte administrateur');
    }
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

  // Accorde ou retire les droits admin à un autre compte (jamais sur soi-même,
  // pour ne jamais risquer de se retrouver sans aucun admin sur la plateforme)
  @Post('users/:id/toggle-admin')
  async toggleAdmin(@Req() req: any, @Param('id') id: string) {
    if (id === req.user.userId) {
      throw new BadRequestException('Impossible de modifier tes propres droits administrateur ici');
    }
    const u = await this.users.findOne({ where: { id } });
    u.isAdmin = !u.isAdmin;
    return this.users.save(u);
  }

  // Ajuste manuellement le portefeuille d'un compte (support client, correction
  // de test...) - montant positif = crédite, négatif = débite.
  @Post('users/:id/wallet-adjust')
  async walletAdjust(@Param('id') id: string, @Body() dto: WalletAdjustDto) {
    const txId = `admin-adjust-${Date.now()}-${id}`;
    if (dto.amount > 0) await this.wallet.credit(id, dto.amount, 'admin_adjust', txId);
    else if (dto.amount < 0) await this.wallet.debit(id, Math.abs(dto.amount), 'admin_adjust', txId);
    return this.wallet.getBalance(id);
  }
}
