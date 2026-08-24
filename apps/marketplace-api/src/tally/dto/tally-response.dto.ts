import { ApiProperty } from '@nestjs/swagger';
import { PlatformRole, TallySyncRecordType, TallySyncStatus } from '@prisma/client';

export class TallySyncAttemptResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tallySyncRecordId!: string;

  @ApiProperty({ minimum: 1 })
  attemptNumber!: number;

  @ApiProperty({ enum: TallySyncStatus })
  outcome!: TallySyncStatus;

  @ApiProperty({ type: String, nullable: true })
  errorCode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  errorMessage!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  performedByUserId!: string | null;

  @ApiProperty({ enum: PlatformRole, nullable: true })
  performedByRole!: PlatformRole | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class TallySyncRecordResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: TallySyncRecordType })
  recordType!: TallySyncRecordType;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  sourceEntityId!: string | null;

  @ApiProperty()
  referenceLabelSnapshot!: string;

  @ApiProperty({ type: String, nullable: true })
  referenceNumberSnapshot!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  amountPaise!: number | null;

  @ApiProperty({ type: 'object', additionalProperties: true })
  payloadSnapshot!: Record<string, unknown>;

  @ApiProperty({ enum: TallySyncStatus })
  status!: TallySyncStatus;

  @ApiProperty({ minimum: 0 })
  attemptCount!: number;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastAttemptAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  lastErrorCode!: string | null;

  @ApiProperty({ type: String, nullable: true })
  lastErrorMessage!: string | null;

  @ApiProperty({ type: String, nullable: true })
  tallyReferenceId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  enqueuedByUserId!: string | null;

  @ApiProperty({ enum: PlatformRole, nullable: true })
  enqueuedByRole!: PlatformRole | null;

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class TallySyncRecordDetailResponseDto extends TallySyncRecordResponseDto {
  @ApiProperty({ type: () => [TallySyncAttemptResponseDto] })
  attempts!: TallySyncAttemptResponseDto[];
}

export class TallySyncRecordPageDataResponseDto {
  @ApiProperty({ type: () => [TallySyncRecordResponseDto] })
  items!: TallySyncRecordResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  limit!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;
}

export class TallySyncRecordPageResponseDto {
  @ApiProperty({ type: () => TallySyncRecordPageDataResponseDto })
  data!: TallySyncRecordPageDataResponseDto;

  @ApiProperty({ example: '01J5EXAMPLECORRELATIONID' })
  requestId!: string;
}

export class TallySyncRecordResponseEnvelopeDto {
  @ApiProperty({ type: () => TallySyncRecordResponseDto })
  data!: TallySyncRecordResponseDto;

  @ApiProperty({ example: '01J5EXAMPLECORRELATIONID' })
  requestId!: string;
}

export class TallySyncRecordDetailResponseEnvelopeDto {
  @ApiProperty({ type: () => TallySyncRecordDetailResponseDto })
  data!: TallySyncRecordDetailResponseDto;

  @ApiProperty({ example: '01J5EXAMPLECORRELATIONID' })
  requestId!: string;
}

export class TallyReconciliationRowResponseDto {
  @ApiProperty({ enum: TallySyncRecordType })
  recordType!: TallySyncRecordType;

  @ApiProperty({ enum: TallySyncStatus })
  status!: TallySyncStatus;

  @ApiProperty({ minimum: 0 })
  count!: number;

  @ApiProperty()
  totalAmountPaise!: number;

  @ApiProperty({ type: Number, minimum: 0, nullable: true })
  oldestUnsyncedAgeHours!: number | null;
}

export class TallyReconciliationResponseDto {
  @ApiProperty({ type: () => [TallyReconciliationRowResponseDto] })
  data!: TallyReconciliationRowResponseDto[];

  @ApiProperty({ example: '01J5EXAMPLECORRELATIONID' })
  requestId!: string;
}
