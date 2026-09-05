import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WalletService } from './wallet.service';

@Controller('wallet')
@UseGuards(AuthGuard('jwt')) // exige un jeton JWT valide (utilisateur connecté)
export class WalletController {
  constructor(private wallet: WalletService) {}

  @Get()
  getMyWallet(@Req() req: any) {
    return this.wallet.getBalance(req.user.userId);
  }
}
