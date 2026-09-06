import { Body, Controller, Get, Injectable, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { User } from './user.entity';

class UpdateProfileDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() city?: string;
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
  constructor(@InjectRepository(User) private users: Repository<User>) {}

  findById(id: string) {
    return this.users.findOne({ where: { id } });
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
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
