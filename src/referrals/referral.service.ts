import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { WalletService } from '../wallet/wallet.service';

const REWARD_FCFA = 500; // bonus versé au parrain, une seule fois par filleul

@Injectable()
export class ReferralService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    private wallet: WalletService,
  ) {}

  // Appelé à chaque commande confirmée / réservation terminée. Ne fait rien
  // si l'utilisateur n'a pas de parrain, ou si son parrain a déjà été
  // récompensé pour lui (une seule récompense par filleul, jamais à
  // l'inscription elle-même - seulement à la première vraie activité, pour
  // éviter les faux comptes créés juste pour le bonus).
  async rewardSponsorIfEligible(userId: string) {
    const user = await this.users.findOne({ where: { id: userId } });
    if (!user || !user.referredBy || user.referralRewarded) return;
    await this.wallet.credit(user.referredBy, REWARD_FCFA, 'referral', `referral-${user.id}`, user.id);
    user.referralRewarded = true;
    await this.users.save(user);
  }
}
