import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { allQueueNames, QueueName } from '../queue-names';

export class ListDeadLetterQueryDto extends PaginationQueryDto {
  @ApiProperty({ enum: allQueueNames as string[] })
  @IsIn(allQueueNames as string[])
  queue!: QueueName;
}
