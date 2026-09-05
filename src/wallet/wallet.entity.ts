import { Column, Entity, OneToOne, JoinColumn, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';
import { User } from '../users/user.entity';

@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid') id: string;

  @OneToOne(() => User) @JoinColumn() user: User;
  @Column() userId: string;

  // decimal (pas float) pour éviter les erreurs d'arrondi sur de l'argent réel
  @Column('decimal', { precision: 12, scale: 2, default: 0 }) balance: number;

  @CreateDateColumn() updatedAt: Date;
}
