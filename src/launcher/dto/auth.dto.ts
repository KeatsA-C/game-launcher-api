// src/launcher/dto/auth.dto.ts
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LauncherAuthDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  code!: string;

  //   @IsString()
  //   @IsNotEmpty()
  //   @MaxLength(128)
  //   deviceId!: string;

  //   @IsOptional()
  //   @IsString()
  //   @MaxLength(64)
  //   buildVersion?: string;
}
