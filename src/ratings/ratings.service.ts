import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RatingEntity } from './rating.entity';

@Injectable()
export class RatingsService {
  constructor(
    @InjectRepository(RatingEntity)
    private ratingsRepo: Repository<RatingEntity>,
  ) {}

  async create(data: Partial<RatingEntity>) {
    const newRating = this.ratingsRepo.create(data);
    return this.ratingsRepo.save(newRating);
    // Dès que ça s'enregistre, le trigger PostgreSQL crédite automatiquement
    // les 0,10 points au client — rien d'autre à faire ici.
  }

  async getForUser(ratedId: string) {
    return this.ratingsRepo.find({ where: { ratedId }, order: { createdAt: 'DESC' } });
  }
  }
