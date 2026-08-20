import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ReviewAdvisoryRuleDto {
  @ApiProperty() @IsBoolean() approved!: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(3) @MaxLength(500) reason?: string;
}

export class AdvisoryActionDto {
  @ApiProperty() @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
