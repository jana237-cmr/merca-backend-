import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() merchantId: string;
  @Column() name: string;
  @Column('decimal', { precision: 12, scale: 2 }) price: number;
  @Column({ default: 0 }) stock: number;
  @Column({ nullable: true }) category: string;
  @Column({ nullable: true }) city: string;
  @Column('text', { array: true, default: [] }) images: string[];
  @Column({ nullable: true }) priceLockedUntil: Date; // règle des 33 jours, vérifiée côté serveur
  @CreateDateColumn() createdAt: Date;
}
