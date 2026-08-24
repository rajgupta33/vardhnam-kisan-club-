import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { allQueueNames } from '../queue-names';

export class JobEnvelopeResponseDto {
  @ApiProperty({ type: 'object', additionalProperties: true })
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({ example: '01J5EXAMPLECORRELATIONID' })
  requestId?: string;

  @ApiProperty({ format: 'date-time' })
  enqueuedAt!: string;
}

export class DeadLetterEntryResponseDto {
  @ApiProperty({ example: '42' })
  id!: string;

  @ApiProperty({ enum: allQueueNames as string[], example: 'notifications' })
  originalQueue!: string;

  @ApiProperty({ example: 'send-notification' })
  originalJobName!: string;

  @ApiProperty({ type: () => JobEnvelopeResponseDto })
  envelope!: JobEnvelopeResponseDto;

  @ApiProperty({ example: 'Notification provider temporarily unavailable' })
  failedReason!: string;

  @ApiPropertyOptional({ example: 'Error: provider unavailable' })
  stack?: string;

  @ApiProperty({ minimum: 0 })
  attemptsMade!: number;

  @ApiProperty({ format: 'date-time' })
  failedAt!: string;
}

export class DeadLetterPageDataResponseDto {
  @ApiProperty({ type: () => [DeadLetterEntryResponseDto] })
  items!: DeadLetterEntryResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  limit!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;
}

export class DeadLetterPageResponseDto {
  @ApiProperty({ type: () => DeadLetterPageDataResponseDto })
  data!: DeadLetterPageDataResponseDto;

  @ApiProperty({ example: '01J5EXAMPLECORRELATIONID' })
  requestId!: string;
}

export class RetryDeadLetterDataResponseDto {
  @ApiProperty({ enum: allQueueNames as string[], example: 'notifications' })
  queue!: string;

  @ApiProperty({ example: '42' })
  deadLetterJobId!: string;

  @ApiProperty({ example: '43' })
  replayJobId!: string;
}

export class RetryDeadLetterResponseDto {
  @ApiProperty({ type: () => RetryDeadLetterDataResponseDto })
  data!: RetryDeadLetterDataResponseDto;

  @ApiProperty({ example: '01J5EXAMPLECORRELATIONID' })
  requestId!: string;
}
