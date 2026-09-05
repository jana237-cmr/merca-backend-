import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() buyerId: string;
  @Column() productId: string;
  @Column() merchantId: string;
  @Column({ nullable: true }) courierId: string;

  // Montants calculés et figés par le SERVEUR au moment de la commande —
  // jamais envoyés depuis l'app, pour empêcher toute triche côté client
  @Column('decimal', { precision: 12, scale: 2 }) price: number;
  @Column('decimal', { precision: 12, scale: 2 }) commission: number;
  @Column('decimal', { precision: 12, scale: 2, default: 1500 }) deliveryFee: number;
  @Column('decimal', { precision: 12, scale: 2, default: 600 }) splitCourier: number;
  @Column('decimal', { precision: 12, scale: 2, default: 450 }) splitMerchant: number;
  @Column('decimal', { precision: 12, scale: 2, default: 450 }) splitMerca: number;
  @Column('decimal', { precision: 12, scale: 2 }) total: number;

  @Column({ default: 0 }) step: number; // 0..4, correspond aux étapes de livraison
  @Column({ default: 'Commande reçue' }) status: string;
  @Column({ unique: true }) deliveryCode: string; // code à 4 chiffres, unicité garantie par la base
  @Column({ unique: true }) idempotencyKey: string; // empêche la création en double si l'app renvoie la requête

  @CreateDateColumn() createdAt: Date;
}
