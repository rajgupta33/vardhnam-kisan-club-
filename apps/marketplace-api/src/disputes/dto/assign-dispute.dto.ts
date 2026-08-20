import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class AssignDisputeDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  assignedToUserId!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  note?: string;
}
