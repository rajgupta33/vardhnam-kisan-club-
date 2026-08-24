import { ApiProperty } from '@nestjs/swagger';
import {
  PlatformRole,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
} from '@prisma/client';

export class SupportTicketResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  raisedByUserId!: string;

  @ApiProperty({ enum: PlatformRole })
  raisedByRole!: PlatformRole;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  raiserOrganisationId!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  productOrderId!: string | null;

  @ApiProperty({ enum: SupportTicketCategory })
  category!: SupportTicketCategory;

  @ApiProperty({ enum: SupportTicketPriority })
  priority!: SupportTicketPriority;

  @ApiProperty()
  subject!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: SupportTicketStatus })
  status!: SupportTicketStatus;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  assignedToUserId!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  assignedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  slaDueAt!: string;

  @ApiProperty({ type: String, nullable: true })
  resolutionNote!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  resolvedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  closedAt!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class SupportTicketPageDataResponseDto {
  @ApiProperty({ type: () => [SupportTicketResponseDto] })
  items!: SupportTicketResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  limit!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;
}

export class SupportTicketPageResponseDto {
  @ApiProperty({ type: () => SupportTicketPageDataResponseDto })
  data!: SupportTicketPageDataResponseDto;

  @ApiProperty({ example: '01J5EXAMPLECORRELATIONID' })
  requestId!: string;
}

export class SupportTicketResponseEnvelopeDto {
  @ApiProperty({ type: () => SupportTicketResponseDto })
  data!: SupportTicketResponseDto;

  @ApiProperty({ example: '01J5EXAMPLECORRELATIONID' })
  requestId!: string;
}
