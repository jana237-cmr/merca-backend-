import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Wallet } from '../wallet/wallet.entity';
import { WalletTransaction } from '../wallet/wallet-transaction.entity';

// Stockage temporaire des codes OTP (code à usage unique envoyé par SMS).
// TODO PRODUCTION : remplacer cette Map en mémoire par Redis, sinon les
// codes disparaissent à chaque redémarrage du serveur et ne fonctionnent
// pas si tu as plusieurs serveurs en parallèle.
const otpStore = new Map<string, { code: string; expiresAt: number; attempts: number }>();

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Wallet) private wallets: Repository<Wallet>,
    @InjectRepository(WalletTransaction) private walletTx: Repository<WalletTransaction>,
    private jwt: JwtService,
  ) {}

  // Étape 1 : le client demande un code, envoyé par SMS
  async requestOtp(phone: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 chiffres
    otpStore.set(phone, { code, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0 });

    // TODO PRODUCTION : appeler ici un vrai fournisseur SMS (Twilio, ou un
    // agrégateur SMS local camerounais) pour envoyer `code` au numéro `phone`.
    // Pour l'instant, en développement, on affiche le code dans les logs :
    console.log(`[DEV] Code OTP pour ${phone} : ${code}`);

    return { sent: true };
  }

  // Étape 2 : le client renvoie le code reçu, on vérifie et on crée une session
  async verifyOtp(phone: string, code: string) {
    const entry = otpStore.get(phone);
    if (!entry) throw new UnauthorizedException('Aucun code demandé pour ce numéro');
    if (Date.now() > entry.expiresAt) { otpStore.delete(phone); throw new UnauthorizedException('Code expiré'); }
    if (entry.attempts >= 3) { otpStore.delete(phone); throw new UnauthorizedException('Trop de tentatives, redemande un code'); }
    if (entry.code !== code) { entry.attempts++; throw new UnauthorizedException('Code incorrect'); }

    otpStore.delete(phone);

    // Cherche un compte existant avec ce numéro, sinon en crée un nouveau
    let user = await this.users.findOne({ where: { phone } });
    if (!user) {
      user = this.users.create({ phone, roles: ['client'] });
      await this.users.save(user);

      // Nouveau compte : on crée son portefeuille (wallet) tout de suite,
      // sinon le premier appel à GET /wallet échouerait ("introuvable").
      // BONUS_TEST = simulation, pas un vrai versement bancaire.
      const BONUS_TEST = 25000;
      const wallet = this.wallets.create({ userId: user.id, balance: BONUS_TEST });
      await this.wallets.save(wallet);
      await this.walletTx.save(
        this.walletTx.create({
          walletId: wallet.id,
          amount: BONUS_TEST,
          type: 'topup',
          txId: `signup-${user.id}`,
        }),
      );
    }

    // JWT (JSON Web Token) = jeton signé prouvant l'identité de l'utilisateur
    // pour les prochains appels à l'API, sans avoir à renvoyer le code à chaque fois
    const accessToken = this.jwt.sign({ sub: user.id, roles: user.roles });
    return { accessToken, user };
  }
}
