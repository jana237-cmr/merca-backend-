import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ unique: true }) phone: string;
  @Column({ nullable: true }) name: string;
  @Column({ nullable: true }) city: string;

  // Rôles actifs du compte : toujours au moins ['client'], peut contenir
  // aussi 'commercant', 'livreur', 'pro'
  @Column('text', { array: true, default: ['client'] }) roles: string[];

  // Champs propres à chaque rôle additionnel (nuls si le rôle n'est pas actif)
  @Column({ nullable: true }) shopName: string;   // commerçant
  @Column({ nullable: true }) vehicule: string;   // livreur
  @Column({ nullable: true }) bureau: string;     // employé pro
  @Column({ nullable: true }) domaine: string;    // employé pro

  // Vérification d'identité (KYC = Know Your Customer, contrôle d'identité)
  // simulée ici par un simple champ ; en vrai il faut un vrai document + un
  // vérificateur humain ou un service tiers spécialisé.
  @Column('text', { array: true, default: [] }) verifiedRoles: string[];

  @CreateDateColumn() createdAt: Date;
}
