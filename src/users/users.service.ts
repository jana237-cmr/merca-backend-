import { Body, Controller, Get, Injectable, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { User } from './user.entity';
import { GeocodingService } from '../geocoding/geocoding.service';

class UpdateProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() pushToken?: string;

  // Rempli automatiquement si le téléphone du commerçant envoie le GPS
  @IsOptional() @IsNumber() latitude?: number;
  @IsOptional() @IsNumber() longitude?: number;

  // Rempli si le commerçant tape son adresse à la main (GPS refusé)
  @IsOptional() @IsString() addressText?: string;
}

class AddRoleDto {
  @IsIn(['commercant', 'livreur', 'pro']) role: 'commercant' | 'livreur' | 'pro';
  @IsOptional() @IsString() shopName?: string;   // commerçant
  @IsOptional() @IsString() vehicule?: string;   // livreur
  @IsOptional() @IsString() bureau?: string;     // employé pro
  @IsOptional() @IsString() domaine?: string;    // employé pro
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private users: Repository<User>,
    private geocoding: GeocodingService,
  ) {}

  findById(id: string) {
    return this.users.findOne({ where: { id } });
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    // Cas 1 : le téléphone a envoyé les coordonnées GPS directement
    // → on les utilise telles quelles, pas besoin de géocodage.
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      await this.users.update({ id }, dto);
      return this.findById(id);
    }

    // Cas 2 : une adresse tapée à la main est fournie, sans GPS
    // → on la convertit en coordonnées via le service de géocodage.
    if (dto.addressText) {
      const coords = await this.geocoding.geocode(dto.addressText);
      const updateData = { ...dto };
      if (coords) {
        updateData['latitude'] = coords.latitude;
        updateData['longitude'] = coords.longitude;
      }
      // Si le géocodage échoue (adresse introuvable), on garde quand même le
      // texte de l'adresse tapée, mais latitude/longitude restent vides pour
      // l'instant — le commerçant pourra réessayer avec une adresse plus précise.
      await this.users.update({ id }, updateData);
      return this.findById(id);
    }

    // Cas 3 : aucun changement de position, mise à jour normale du profil
    await this.users.update({ id }, dto);
    return this.findById(id);
  }

  async addRole(id: string, dto: AddRoleDto) {
    const user = await this.users.findOne({ where: { id } });
    const roles = new Set(user.roles || ['client']);
    roles.add(dto.role);
    user.roles = Array.from(roles);
    if (dto.shopName !== undefined) user.shopName = dto.shopName;
    if (dto.vehicule !== undefined) user.vehicule = dto.vehicule;
    if (dto.bureau !== undefined) user.bureau = dto.bureau;
    if (dto.domaine !== undefined) user.domaine = dto.domaine;
    return this.users.save(user);
  }
}

@Controller('users/me')
@UseGuards(AuthGuard('jwt'))
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  me(@Req() req: any) {
    return this.users.findById(req.user.userId);
  }

  @Patch()
  update(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(req.user.userId, dto);
  }

  @Post('roles')
  addRole(@Req() req: any, @Body() dto: AddRoleDto) {
    return this.users.addRole(req.user.userId, dto);
  }
    }
