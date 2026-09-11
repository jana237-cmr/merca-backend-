import { Body, Controller, Post } from '@nestjs/common';
import { IsPhoneNumber, IsString, Length } from 'class-validator';
import { AuthService } from './auth.service';

class RequestOtpDto { @IsPhoneNumber() phone: string; } // accepte tous les pays (le numéro doit commencer par + et son indicatif)
class VerifyOtpDto { @IsPhoneNumber() phone: string; @IsString() @Length(6, 6) code: string; }

// Uniformise le format du numéro avant toute recherche/création en base -
// évite qu'un même numéro tapé différemment (espaces, tirets) crée 2 comptes distincts.
function normalizePhone(raw: string): string {
  return raw.replace(/[\s-]/g, '');
}

@Controller('auth/otp')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('request')
  request(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(normalizePhone(dto.phone));
  }

  @Post('verify')
  verify(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(normalizePhone(dto.phone), dto.code);
  }
}
