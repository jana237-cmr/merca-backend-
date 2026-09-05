import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsBoolean, IsNumber, IsString, IsUUID, Min } from 'class-validator';
import { OrdersService } from './orders.service';

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
  constructor(private orders: OrdersService) {}

  @Post()
  create(@Req() req: any, @Body() dto: CreateOrderDto) {
    return this.orders.createOrder(req.user.userId, dto.productPrice, dto.productId, dto.merchantId, dto.delivery, dto.idempotencyKey);
  }

  @Post(':id/advance')
  advance(@Req() req: any, @Param('id') id: string) {
    return this.orders.advance(id, req.user.userId, req.user.roles || []);
  }

  @Post(':id/confirm')
  confirm(@Req() req: any, @Param('id') id: string) {
    return this.orders.confirmReception(id, req.user.userId);
  }
}
