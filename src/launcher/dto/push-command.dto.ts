// src/launcher/dto/push-command.dto.ts
import { IsIn, IsNotEmpty, IsObject, IsString } from 'class-validator';

export class PushCommandDto {
  @IsString()
  @IsNotEmpty()
  code!: string; // launch code alias from /launcher/run

  @IsIn(['runGame'])
  type!: 'runGame';

  @IsObject()
  payload!: { id: string; name: string };
}
