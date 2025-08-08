import { IsUUID, IsString } from 'class-validator';

export class GetLicenseDto {
  @IsUUID()
  id!: string;

  @IsString()
  name!: string;
}
