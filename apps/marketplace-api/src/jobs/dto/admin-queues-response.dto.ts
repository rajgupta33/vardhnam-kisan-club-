import { ApiProperty } from '@nestjs/swagger';
import { allQueueNames } from '../queue-names';

export class QueueDepthResponseDto {
  @ApiProperty({ enum: allQueueNames as string[], example: 'notifications' })
  queue!: string;

  @ApiProperty({ minimum: 0 })
  waiting!: number;

  @ApiProperty({ minimum: 0 })
  active!: number;

  @ApiProperty({ minimum: 0 })
  completed!: number;

  @ApiProperty({ minimum: 0 })
  failed!: number;

  @ApiProperty({ minimum: 0 })
  delayed!: number;

  @ApiProperty({ minimum: 0 })
  deadLetter!: number;
}

export class ScheduledJobDefinitionResponseDto {
  @ApiProperty({ example: 'expire-otp-challenges' })
  jobName!: string;

  @ApiProperty({ example: '10 * * * *' })
  pattern!: string;

  @ApiProperty({ example: 'Delete expired and consumed OTP challenges' })
  description!: string;
}

export class AdminQueuesDataResponseDto {
  @ApiProperty({ type: () => [QueueDepthResponseDto] })
  queues!: QueueDepthResponseDto[];

  @ApiProperty({ type: () => [ScheduledJobDefinitionResponseDto] })
  scheduledJobs!: ScheduledJobDefinitionResponseDto[];
}

/** Documents the global success envelope applied by ResponseEnvelopeInterceptor. */
export class AdminQueuesResponseDto {
  @ApiProperty({ type: () => AdminQueuesDataResponseDto })
  data!: AdminQueuesDataResponseDto;

  @ApiProperty({ example: '01J5EXAMPLECORRELATIONID' })
  requestId!: string;
}
