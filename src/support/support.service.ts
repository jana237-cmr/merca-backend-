import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Message } from './message.entity';
import { Dispute } from './dispute.entity';
import { AdminGuard } from '../admin/admin.service';

// Motifs de litige autorisés (mêmes libellés que côté app).
const DISPUTE_REASONS = [
  'Produit/service non conforme',
  'Retard',
  'Vendeur injoignable',
  'Problème de paiement',
  'Autre',
];

// ============================================================================
// SUPPORT (messagerie + litiges) — VRAI système côté serveur.
// Un "thread" (fil de discussion) est toujours l'id d'une vraie commande
// (table orders) ou d'une vraie réservation (table bookings) — jamais un id
// inventé. Avant de lire ou d'écrire dans un thread, on vérifie toujours que
// l'utilisateur en fait réellement partie (acheteur/commerçant/livreur pour
// une commande, client/pro pour une réservation). Impossible donc d'espionner
// ou d'écrire dans la conversation de quelqu'un d'autre.
// ============================================================================
@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(Message) private messages: Repository<Message>,
    @InjectRepository(Dispute) private disputes: Repository<Dispute>,
    @InjectDataSource() private dataSource: DataSource,
  ) {}

  // Retrouve le thread (commande ou réservation) et vérifie que userId y a
  // réellement accès. Lève une erreur sinon (thread introuvable ou accès refusé).
  private async checkThreadAccess(threadId: string, userId: string): Promise<'order' | 'booking'> {
    const orderRows = await this.dataSource.query(
      `select buyer_id, merchant_id, courier_id from orders where id = $1`,
      [threadId],
    );
    if (orderRows.length) {
      const o = orderRows[0];
      const participants = [o.buyer_id, o.merchant_id, o.courier_id].filter(Boolean);
      if (!participants.includes(userId)) {
        throw new ForbiddenException("Tu n'as pas accès à cette conversation");
      }
      return 'order';
    }
    const bookingRows = await this.dataSource.query(
      `select client_id, pro_id from bookings where id = $1`,
      [threadId],
    );
    if (bookingRows.length) {
      const b = bookingRows[0];
      const participants = [b.client_id, b.pro_id].filter(Boolean);
      if (!participants.includes(userId)) {
        throw new ForbiddenException("Tu n'as pas accès à cette conversation");
      }
      return 'booking';
    }
    throw new NotFoundException('Commande ou réservation introuvable');
  }

  async sendMessage(userId: string, threadId: string, body: string) {
    if (!body || !body.trim()) throw new BadRequestException('Le message ne peut pas être vide');
    await this.checkThreadAccess(threadId, userId);
    const msg = this.messages.create({ threadId, senderId: userId, body: body.trim() });
    return this.messages.save(msg);
  }

  async getMessages(userId: string, threadId: string) {
    await this.checkThreadAccess(threadId, userId);
    return this.messages.find({ where: { threadId }, order: { createdAt: 'ASC' } });
  }

  async createDispute(userId: string, threadId: string, reason: string, description: string) {
    if (!DISPUTE_REASONS.includes(reason)) throw new BadRequestException('Motif de litige invalide');
    await this.checkThreadAccess(threadId, userId);
    const existing = await this.disputes.findOne({ where: { threadId, raisedBy: userId, status: 'ouvert' } });
    if (existing) throw new BadRequestException('Tu as déjà un litige ouvert pour cette commande/réservation');
    const d = this.disputes.create({
      threadId,
      raisedBy: userId,
      reason,
      description: description ? description.trim() : '',
      status: 'ouvert',
    });
    return this.disputes.save(d);
  }

  async getMyDisputes(userId: string) {
    return this.disputes.find({ where: { raisedBy: userId }, order: { createdAt: 'DESC' } });
  }

  async getThreadDisputes(userId: string, threadId: string) {
    await this.checkThreadAccess(threadId, userId);
    return this.disputes.find({ where: { threadId }, order: { createdAt: 'DESC' } });
  }

  // ---- Administration (MERCA uniquement) ----
  async adminGetAllDisputes() {
    return this.disputes.find({ order: { createdAt: 'DESC' } });
  }

  async adminResolveDispute(id: string, status: string) {
    const allowed = ['ouvert', 'en_cours', 'resolu', 'rejete'];
    if (!allowed.includes(status)) throw new BadRequestException('Statut invalide');
    const d = await this.disputes.findOne({ where: { id } });
    if (!d) throw new NotFoundException('Litige introuvable');
    d.status = status;
    return this.disputes.save(d);
  }
}

@Controller('support')
@UseGuards(AuthGuard('jwt'))
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('messages')
  sendMessage(@Req() req, @Body() dto: { threadId: string; body: string }) {
    return this.support.sendMessage(req.user.userId, dto.threadId, dto.body);
  }

  @Get('messages/:threadId')
  getMessages(@Req() req, @Param('threadId') threadId: string) {
    return this.support.getMessages(req.user.userId, threadId);
  }

  @Post('disputes')
  createDispute(@Req() req, @Body() dto: { threadId: string; reason: string; description: string }) {
    return this.support.createDispute(req.user.userId, dto.threadId, dto.reason, dto.description);
  }

  @Get('disputes/mine')
  getMyDisputes(@Req() req) {
    return this.support.getMyDisputes(req.user.userId);
  }

  @Get('disputes/:threadId')
  getThreadDisputes(@Req() req, @Param('threadId') threadId: string) {
    return this.support.getThreadDisputes(req.user.userId, threadId);
  }
}

@Controller('admin/disputes')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminDisputesController {
  constructor(private readonly support: SupportService) {}

  @Get()
  getAll() {
    return this.support.adminGetAllDisputes();
  }

  @Post(':id/resolve')
  resolve(@Param('id') id: string, @Body() dto: { status: string }) {
    return this.support.adminResolveDispute(id, dto.status);
  }
}
