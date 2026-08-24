import { ApiProperty } from '@nestjs/swagger';
import {
  CommissionEntryStatus,
  CommissionEntryType,
  PayoutAccountStatus,
  PlatformRole,
} from '@prisma/client';

export class PayoutAccountResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty()
  accountHolderName!: string;

  @ApiProperty()
  bankName!: string;

  @ApiProperty({ description: 'Backend-masked account number with at most four visible digits' })
  accountNumber!: string;

  @ApiProperty()
  ifscCode!: string;

  @ApiProperty({ type: String, nullable: true })
  upiId!: string | null;

  @ApiProperty({ enum: PayoutAccountStatus })
  status!: PayoutAccountStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  verifiedAt!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  verifiedByUserId!: string | null;

  @ApiProperty({ enum: PlatformRole, nullable: true })
  verifiedByRole!: PlatformRole | null;

  @ApiProperty({ type: String, nullable: true })
  rejectionReason!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class PayoutAccountPageDataResponseDto {
  @ApiProperty({ type: () => [PayoutAccountResponseDto] })
  items!: PayoutAccountResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  limit!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;
}

export class PayoutAccountPageResponseDto {
  @ApiProperty({ type: () => PayoutAccountPageDataResponseDto })
  data!: PayoutAccountPageDataResponseDto;

  @ApiProperty({ example: '01J5EXAMPLECORRELATIONID' })
  requestId!: string;
}

export class PayoutAccountResponseEnvelopeDto {
  @ApiProperty({ type: () => PayoutAccountResponseDto })
  data!: PayoutAccountResponseDto;

  @ApiProperty({ example: '01J5EXAMPLECORRELATIONID' })
  requestId!: string;
}

export class PayoutCommissionEntryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  productOrderId!: string;

  @ApiProperty({ format: 'uuid' })
  sellerOrganisationId!: string;

  @ApiProperty({ format: 'uuid' })
  commissionRuleId!: string;

  @ApiProperty({ enum: CommissionEntryType })
  entryType!: CommissionEntryType;

  @ApiProperty()
  amountPaise!: number;

  @ApiProperty({ enum: CommissionEntryStatus })
  status!: CommissionEntryStatus;

  @ApiProperty({ format: 'date-time' })
  eligibleAt!: string;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  finalizedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  reversedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  reversalReason!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  settlementId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  recipientUserId!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;
}

export class PayoutStatementTotalResponseDto {
  @ApiProperty({ enum: CommissionEntryStatus })
  status!: CommissionEntryStatus;

  @ApiProperty()
  amountPaise!: number;
}

export class PayoutStatementDataResponseDto {
  @ApiProperty({ type: () => [PayoutCommissionEntryResponseDto] })
  items!: PayoutCommissionEntryResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  limit!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;

  @ApiProperty({ type: () => [PayoutStatementTotalResponseDto] })
  totalsByStatus!: PayoutStatementTotalResponseDto[];
}

export class PayoutStatementResponseDto {
  @ApiProperty({ type: () => PayoutStatementDataResponseDto })
  data!: PayoutStatementDataResponseDto;

  @ApiProperty({ example: '01J5EXAMPLECORRELATIONID' })
  requestId!: string;
}
