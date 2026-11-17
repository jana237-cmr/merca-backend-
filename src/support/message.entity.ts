import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Un message de la messagerie interne (support), rattaché à une commande
// ou une réservation (threadId = id de la commande/réservation concernée).
@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() threadId: string;
  @Column() senderId: string;
  @Column('text') body: string;
  @CreateDateColumn() createdAt: Date;
}
