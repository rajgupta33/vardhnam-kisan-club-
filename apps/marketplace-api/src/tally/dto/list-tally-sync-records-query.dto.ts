import { ApiPropertyOptional } from '@nestjs/swagger';
import { TallySyncRecordType, TallySyncStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export class ListTallySyncRecordsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: TallySyncRecordType })
  @IsOptional()
  @IsEnum(TallySyncRecordType)
  recordType?: TallySyncRecordType;

  @ApiPropertyOptional({ enum: TallySyncStatus })
  @IsOptional()
  @IsEnum(TallySyncStatus)
  status?: TallySyncStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  sourceEntityId?: string;
}
