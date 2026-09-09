import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsBoolean, IsNumber, IsString, IsUUID, Min } from 'class-validator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrdersService } from './orders.service';
import { User } from '../users/user.entity';
import { sendPushNotification } from '../notifications/push.util';

class CreateOrderDto {
  @IsUUID() productId: string;
  @IsUUID() merchantId: string;
  @IsNumber() @Min(1) productPrice: number;
  @IsBoolean() delivery: boolean;
  @IsString() idempotencyKey: string; // généré côté app à la création de l'écran checkout
}

@Controller('orders')
@UseGuards(AuthGuard('jwt'))
export class OrdersController {
  constructor(
    private orders: OrdersService,
    @InjectRepository(User) private users: Repository<User>,
  ) {}

  @Post()
  async create(@Req() req: any, @Body() dto: CreateOrderDto) {
    const order = await this.orders.createOrder(req.user.userId, dto.productPrice, dto.productId, dto.merchantId, dto.delivery, dto.idempotencyKey);
    // Prévient le commerçant qu'une nouvelle commande est arrivée (notification
    // push si sa vraie app est installée, sinon ne fait simplement rien)
    const merchant = await this.users.findOne({ where: { id: dto.merchantId } });
    if (merchant?.pushToken) {
      sendPushNotification(merchant.pushToken, 'Nouvelle commande MERCA 🛍️', `Une commande de ${dto.productPrice} FCFA vient d'arriver.`, { orderId: order.id });
    }
    return order;
  }

  @Post(':id/advance')
  async advance(@Req() req: any, @Param('id') id: string) {
    const order = await this.orders.advance(id, req.user.userId, req.user.roles || []);
    if (order.step === 4) {
      // La commande est "Livrée" - le client doit confirmer la réception
      const buyer = await this.users.findOne({ where: { id: order.buyerId } });
      if (buyer?.pushToken) {
        sendPushNotification(buyer.pushToken, 'Commande livrée 📦', 'Ta commande est arrivée - confirme la réception dans MERCA.', { orderId: order.id });
      }
    }
    return order;
  }

  @Post(':id/confirm')
  confirm(@Req() req: any, @Param('id') id: string) {
    return this.orders.confirmReception(id, req.user.userId);
  }

  @Get('mine')
  mine(@Req() req: any) {
    return this.orders.listMine(req.user.userId);
  }

  @Get('to-fulfill')
  toFulfill(@Req() req: any) {
    return this.orders.listToFulfill(req.user.userId);
  }

  @Get('available')
  available() {
    return this.orders.listAvailableForCourier();
  }

  @Get('deliveries')
  deliveries(@Req() req: any) {
    return this.orders.listMyDeliveries(req.user.userId);
  }
}
