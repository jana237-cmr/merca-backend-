import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('wallet_transactions')
export class WalletTransaction {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column() walletId: string;
  @Column('decimal', { precision: 12, scale: 2 }) amount: number; // négatif = débit, positif = crédit
  @Column() type: string; // 'order' | 'booking' | 'topup' | 'refund' | 'payout'
  @Column({ nullable: true }) refOrderId: string;

  // idempotency key (clé d'unicité) : si l'app envoie deux fois la même
  // requête (mauvaise connexion, double-clic), ce champ UNIQUE empêche de
  // débiter deux fois le même paiement
  @Column({ unique: true }) txId: string;

  @CreateDateColumn() createdAt: Date;
}
