import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Wallet } from '../wallet/wallet.entity';
import { WalletTransaction } from '../wallet/wallet-transaction.entity';
import { OtpCode } from './otp-code.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    @InjectRepository(Wallet) private wallets: Repository<Wallet>,
    @InjectRepository(WalletTransaction) private walletTx: Repository<WalletTransaction>,
    @InjectRepository(OtpCode) private otpCodes: Repository<OtpCode>,
    private jwt: JwtService,
  ) {}

  // Étape 1 : le client demande un code, envoyé par SMS
  async requestOtp(phone: string) {
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 chiffres

    // Stocké en base de données (et non plus en mémoire) : le code survit
    // maintenant aux redémarrages/redéploiements du serveur.
    await this.otpCodes.delete({ phone }); // supprime un éventuel ancien code pour ce numéro
    await this.otpCodes.save(
      this.otpCodes.create({ phone, code, expiresAt: new Date(Date.now() + 5 * 60 * 1000), attempts: 0 }),
    );

    // TODO PRODUCTION : appeler ici un vrai fournisseur SMS (Twilio, ou un
    // agrégateur SMS local camerounais) pour envoyer `code` au numéro `phone`.
    // Pour l'instant, en développement, on affiche le code dans les logs :
    console.log(`[DEV] Code OTP pour ${phone} : ${code}`);

    // ⚠️ TEMPORAIRE (phase de test uniquement) : on renvoie aussi le code
    // directement dans la réponse, pour que l'app puisse l'afficher sans
    // avoir besoin d'un vrai SMS. À SUPPRIMER avant le lancement public
    // (sinon n'importe qui pourrait se connecter à la place du vrai propriétaire du numéro).
    return { sent: true, devCode: code };
  }

  // Étape 2 : le client renvoie le code reçu, on vérifie et on crée une session
  async verifyOtp(phone: string, code: string, referralCode?: string) {
    const entry = await this.otpCodes.findOne({ where: { phone } });
    if (!entry) throw new UnauthorizedException('Aucun code demandé pour ce numéro');
    if (Date.now() > entry.expiresAt.getTime()) { await this.otpCodes.delete({ phone }); throw new UnauthorizedException('Code expiré'); }
    if (entry.attempts >= 3) { await this.otpCodes.delete({ phone }); throw new UnauthorizedException('Trop de tentatives, redemande un code'); }
    if (entry.code !== code) {
      entry.attempts++;
      await this.otpCodes.save(entry);
      throw new UnauthorizedException('Code incorrect');
    }

    await this.otpCodes.delete({ phone });

    // Cherche un compte existant avec ce numéro, sinon en crée un nouveau
    let user = await this.users.findOne({ where: { phone } });
    if (user?.isSuspended) throw new UnauthorizedException('Ce compte a été suspendu. Contacte le support MERCA.');
    if (!user) {
      // MERCA CERCLE : génère un code personnel unique à partager (parrainage)
      let myCode: string;
      do { myCode = Math.random().toString(36).slice(2, 8).toUpperCase(); }
      while (await this.users.findOne({ where: { referralCode: myCode } }));

      // Si un code de parrain valide est fourni, on le lie (la récompense
      // n'est donnée que plus tard, à la première vraie transaction confirmée -
      // voir OrdersService/BookingsService - pour éviter les faux comptes).
      let referredBy: string | undefined;
      if (referralCode) {
        const sponsor = await this.users.findOne({ where: { referralCode } });
        if (sponsor) referredBy = sponsor.id;
      }

      user = this.users.create({ phone, roles: ['client'], referralCode: myCode, referredBy });
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
