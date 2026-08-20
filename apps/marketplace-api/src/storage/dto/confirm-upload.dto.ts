import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';

export class ConfirmUploadDto {
  @ApiPropertyOptional({
    description:
      'Optional SHA-256 of the uploaded bytes. When supplied it is compared with the stored object and a mismatch rejects the upload.',
    example: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/, { message: 'checksumSha256 must be a lowercase hex SHA-256 digest' })
  checksumSha256?: string;
}
