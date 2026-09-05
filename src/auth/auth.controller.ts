import { Body, Controller, Post } from '@nestjs/common';
import { IsPhoneNumber, IsString, Length } from 'class-validator';
import { AuthService } from './auth.service';

class RequestOtpDto { @IsPhoneNumber() phone: string; }
class VerifyOtpDto { @IsPhoneNumber() phone: string; @IsString() @Length(6, 6) code: string; }

@Controller('auth/otp')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('request')
  request(@Body() dto: RequestOtpDto) {
    return this.auth.requestOtp(dto.phone);
  }

  @Post('verify')
  verify(@Body() dto: VerifyOtpDto) {
    return this.auth.verifyOtp(dto.phone, dto.code);
  }
}
