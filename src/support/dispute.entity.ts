import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

// Un litige (réclamation) ouvert sur une commande ou une réservation.
// status possibles : "ouvert", "en_cours", "resolu", "rejete".
@Entity('disputes')
export class Dispute {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() threadId: string;
  @Column() raisedBy: string;
  @Column() reason: string;
  @Column('text', { nullable: true }) description: string;
  @Column({ default: 'ouvert' }) status: string;
  @CreateDateColumn() createdAt: Date;
}
