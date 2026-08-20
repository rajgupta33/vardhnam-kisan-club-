import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class AttachReturnEvidenceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  storedFileId!: string;

  @ApiPropertyOptional({ maxLength: 300, example: 'Seal was broken when the parcel arrived.' })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  caption?: string;
}
