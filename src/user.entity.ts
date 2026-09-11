import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid') id: string;

  @Column({ unique: true }) phone: string;
  @Column({ nullable: true }) name: string;
  @Column({ nullable: true }) city: string;

  // Coordonnées GPS du compte (position du commerçant/employé pro pour la
  // recherche par proximité). Remplies automatiquement via le GPS du téléphone,
  // ou calculées à partir de addressText si l'utilisateur tape son adresse
  // manuellement (voir GeocodingService).
  @Column('double precision', { nullable: true }) latitude: number;
  @Column('double precision', { nullable: true }) longitude: number;

  // Adresse tapée manuellement quand le GPS n'est pas utilisé (ex: "Yaoundé,
  // Bastos, rue 1.234"). Sert aussi à réafficher l'adresse à l'utilisateur.
  @Column({ nullable: true }) addressText: string;

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

  // Jeton de notification push (Expo Push Token) - permet d'envoyer une vraie
  // notification au téléphone de l'utilisateur, même app fermée. Ne fonctionne
  // que sur une vraie app installée (pas dans Expo Go) - sera rempli automatiquement
  // une fois l'app construite en version finale.
  @Column({ nullable: true }) pushToken: string;

  // ---- Administration MERCA (toi uniquement) ----
  @Column({ default: false }) isAdmin: boolean;
  @Column({ default: false }) isSuspended: boolean;

  @CreateDateColumn() createdAt: Date;
}
