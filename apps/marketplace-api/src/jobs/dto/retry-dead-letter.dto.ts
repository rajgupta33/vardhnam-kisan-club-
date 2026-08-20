import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { allQueueNames, QueueName } from '../queue-names';

export class RetryDeadLetterDto {
  @ApiProperty({ enum: allQueueNames as string[] })
  @IsIn(allQueueNames as string[])
  queue!: QueueName;

  @ApiPropertyOptional({ example: 'Downstream provider outage resolved' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
