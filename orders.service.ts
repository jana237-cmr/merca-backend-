import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './order.entity';
import { WalletService } from '../wallet/wallet.service';

// Règles économiques MERCA — copiées ici volontairement (et pas dans l'app)
// car c'est le SERVEUR qui doit être la seule source de vérité sur l'argent.
const RULES = {
  FRAIS: 0.033,
  BASE: 1500,
  SPLIT_LIVREUR: 600,
  SPLIT_MARCHAND: 450,
  SPLIT_MERCA: 450,
  BLOQUE_JOURS: 33,
};

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private orders: Repository<Order>,
    private wallet: WalletService,
  ) {}

  private async generateUniqueCode(): Promise<string> {
    // Boucle jusqu'à trouver un code à 4 chiffres non utilisé en base.
    // En pratique, avec 9000 codes possibles, une collision est rare, mais
    // on la vérifie quand même — jamais de code "probablement unique".
    for (let i = 0; i < 20; i++) {
      const code = Math.floor(1000 + Math.random() * 9000).toString();
      const exists = await this.orders.findOne({ where: { deliveryCode: code } });
      if (!exists) return code;
    }
    throw new Error('Impossible de générer un code livraison unique, réessaie');
  }

  async createOrder(buyerId: string, productPrice: number, productId: string, merchantId: string, delivery: boolean, idempotencyKey: string) {
    // Protection anti-doublon réseau : si l'app renvoie deux fois la même
    // requête (ex: mauvaise connexion), on ne crée pas deux commandes.
    const existing = await this.orders.findOne({ where: { idempotencyKey } });
    if (existing) return existing;

    const commission = Math.round(productPrice * RULES.FRAIS);
    const deliveryFee = delivery ? RULES.BASE : 0;
    const total = productPrice + commission + deliveryFee;
    const deliveryCode = await this.generateUniqueCode();

    // Débite le portefeuille AVANT de créer la commande. Si le solde est
    // insuffisant, debit() lève une erreur et aucune commande n'est créée.
    await this.wallet.debit(buyerId, total, 'order', idempotencyKey);

    const order = this.orders.create({
      buyerId, productId, merchantId, price: productPrice, commission,
      deliveryFee, splitCourier: delivery ? RULES.SPLIT_LIVREUR : 0,
      splitMerchant: delivery ? RULES.SPLIT_MARCHAND : 0,
      splitMerca: delivery ? RULES.SPLIT_MERCA : 0,
      total, deliveryCode, idempotencyKey,
    });
    return this.orders.save(order);
  }

  // Qui a le droit de faire avancer une commande, selon l'étape où elle est :
  // - étapes 0→1→2 (préparation, recherche livreur) = le marchand
  // - étape 2→3 (le livreur prend la commande) = n'importe quel livreur, qui
  //   devient alors le livreur assigné (courierId)
  // - étape 3→4 (en livraison → livrée) = uniquement le livreur assigné
  async advance(orderId: string, actorId: string, actorRoles: string[] = []) {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Commande introuvable');

    if (order.step <= 1) {
      if (order.merchantId !== actorId) throw new ForbiddenException("Seul le marchand peut faire avancer cette étape");
    } else if (order.step === 2) {
      if (!actorRoles.includes('livreur')) throw new ForbiddenException('Seul un livreur peut prendre cette commande');
      order.courierId = actorId; // ce livreur devient l'assigné pour la suite
    } else if (order.step === 3) {
      if (order.courierId !== actorId) throw new ForbiddenException("Cette commande est assignée à un autre livreur");
    }

    order.step = Math.min(order.step + 1, 4);
    return this.orders.save(order);
  }

  // Le client confirme la réception -> on libère l'argent bloqué (escrow)
  // vers le livreur et le marchand, dans DEUX crédits séparés et traçables
  async confirmReception(orderId: string, buyerId: string) {
    const order = await this.orders.findOne({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Commande introuvable');
    if (order.buyerId !== buyerId) throw new BadRequestException('Cette commande ne t\'appartient pas');
    if (order.status === 'Confirmée') throw new ConflictException('Déjà confirmée');

    if (Number(order.splitCourier) > 0) {
      await this.wallet.credit(order.courierId, Number(order.splitCourier), 'payout', `payout-courier-${order.id}`, order.id);
    }
    await this.wallet.credit(order.merchantId, Number(order.splitMerchant), 'payout', `payout-merchant-${order.id}`, order.id);
    // Le montant MERCA (commission de la plateforme) n'est pas crédité à un
    // wallet utilisateur — dans une vraie compta, il part vers un compte
    // "revenus MERCA" séparé. À définir selon comment tu veux le suivre.

    order.status = 'Confirmée';
    order.step = 4;
    return this.orders.save(order);
  }
}
