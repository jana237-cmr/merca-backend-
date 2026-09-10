import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('otp_codes')
export class OtpCode {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() phone: string;
  @Column() code: string;
  @Column() expiresAt: Date;
  @Column({ default: 0 }) attempts: number;
  @CreateDateColumn() createdAt: Date;
}
