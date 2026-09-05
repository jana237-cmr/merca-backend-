import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Wallet } from './wallet.entity';
import { WalletTransaction } from './wallet-transaction.entity';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet) private wallets: Repository<Wallet>,
    private dataSource: DataSource,
  ) {}

  async getBalance(userId: string) {
    const wallet = await this.wallets.findOne({ where: { userId } });
    if (!wallet) throw new NotFoundException('Portefeuille introuvable');
    return { balance: Number(wallet.balance) };
  }

  // Débite le portefeuille de façon atomique = soit tout se passe (vérifier
  // le solde + créer la transaction + baisser le solde), soit rien ne se
  // passe si une erreur survient en cours de route. Ça évite qu'un client
  // se retrouve débité sans commande créée, ou l'inverse.
  async debit(userId: string, amount: number, type: string, txId: string, refOrderId?: string) {
    if (amount <= 0) throw new BadRequestException('Montant invalide');

    return this.dataSource.transaction(async (manager) => {
      // Vérifie l'idempotence : si cette transaction a déjà été traitée
      // (même txId), on ne débite pas une deuxième fois — on renvoie
      // simplement le résultat comme si tout allait bien.
      const existing = await manager.findOne(WalletTransaction, { where: { txId } });
      if (existing) return { alreadyProcessed: true };

      // SELECT ... FOR UPDATE = verrouille la ligne pendant la transaction
      // pour empêcher deux débits simultanés de "doubler" le solde
      const wallet = await manager
        .createQueryBuilder(Wallet, 'w')
        .setLock('pessimistic_write')
        .where('w.userId = :userId', { userId })
        .getOne();
      if (!wallet) throw new NotFoundException('Portefeuille introuvable');
      if (Number(wallet.balance) < amount) throw new BadRequestException('Solde insuffisant');

      wallet.balance = Number(wallet.balance) - amount;
      await manager.save(wallet);
      await manager.save(manager.create(WalletTransaction, { walletId: wallet.id, amount: -amount, type, txId, refOrderId }));

      return { alreadyProcessed: false, newBalance: wallet.balance };
    }).catch((e) => {
      if (e.code === '23505') throw new ConflictException('Transaction déjà traitée'); // 23505 = violation de contrainte UNIQUE en PostgreSQL
      throw e;
    });
  }

  async credit(userId: string, amount: number, type: string, txId: string, refOrderId?: string) {
    if (amount <= 0) throw new BadRequestException('Montant invalide');
    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.findOne(WalletTransaction, { where: { txId } });
      if (existing) return { alreadyProcessed: true };

      const wallet = await manager
        .createQueryBuilder(Wallet, 'w')
        .setLock('pessimistic_write')
        .where('w.userId = :userId', { userId })
        .getOne();
      if (!wallet) throw new NotFoundException('Portefeuille introuvable');

      wallet.balance = Number(wallet.balance) + amount;
      await manager.save(wallet);
      await manager.save(manager.create(WalletTransaction, { walletId: wallet.id, amount, type, txId, refOrderId }));

      return { alreadyProcessed: false, newBalance: wallet.balance };
    });
  }
}
