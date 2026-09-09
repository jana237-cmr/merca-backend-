import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('ratings_history')
export class RatingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  raterId: string;

  @Column()
  ratedId: string;

  @Column({ nullable: true })
  orderId: string;

  @Column()
  rating: number;

  @Column({ nullable: true })
  comment: string;

  @CreateDateColumn()
  createdAt: Date;
  }
