import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // lit le jeton dans l'en-tête "Authorization: Bearer ..."
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  // Ce que retourne cette fonction devient `req.user` dans les contrôleurs
  async validate(payload: any) {
    return { userId: payload.sub, roles: payload.roles };
  }
}
