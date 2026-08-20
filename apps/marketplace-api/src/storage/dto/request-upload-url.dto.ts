import { ApiProperty } from '@nestjs/swagger';
import { StoredFilePurpose } from '@prisma/client';
import { IsEnum, IsInt, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { allowedContentTypesForAllPurposes } from '../upload-policy';

// The absolute ceiling accepted by validation; the per-purpose limit is applied
// by the service and is stricter for most purposes.
const MAX_DECLARED_SIZE_BYTES = 10 * 1024 * 1024;

export class RequestUploadUrlDto {
  @ApiProperty({ enum: StoredFilePurpose })
  @IsEnum(StoredFilePurpose)
  purpose!: StoredFilePurpose;

  @ApiProperty({ example: 'gst-certificate.pdf' })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  // An allowlist rather than a denylist: this filename is stored and echoed back
  // to other users, so anything outside this set -- path separators, control
  // characters, markup -- has no legitimate use. It never forms part of the
  // storage key.
  @Matches(/^[A-Za-z0-9 ._()-]+$/, {
    message: 'filename may contain only letters, digits, spaces and the characters . _ - ( )',
  })
  filename!: string;

  @ApiProperty({ example: 'application/pdf', enum: allowedContentTypesForAllPurposes })
  @IsString()
  @MaxLength(150)
  contentType!: string;

  @ApiProperty({ example: 248_312, minimum: 1, maximum: MAX_DECLARED_SIZE_BYTES })
  @IsInt()
  @Min(1)
  @Max(MAX_DECLARED_SIZE_BYTES)
  sizeBytes!: number;
}
