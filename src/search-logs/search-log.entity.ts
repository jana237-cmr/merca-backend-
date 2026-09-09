import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('search_logs')
export class SearchLogEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  userId: string;

  @Column()
  query: string;

  @Column({ default: true })
  hasResults: boolean;

  @CreateDateColumn()
  createdAt: Date;
  }
