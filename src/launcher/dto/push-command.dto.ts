// src/launcher/dto/push-command.dto.ts
import {
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export class PushCommandDto {
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @IsIn(['runGame'])
  type!: 'runGame';

  @IsObject()
  payload!: { id: string; name: string };

  @IsOptional()
  @IsString()
  instanceId?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsString()
  code?: string; // NEW: treat launch code as a routing alias
}
