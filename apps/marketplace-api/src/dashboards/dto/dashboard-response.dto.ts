import { ApiProperty } from '@nestjs/swagger';

export enum DashboardScope {
  PLATFORM = 'PLATFORM',
  ORGANISATION = 'ORGANISATION',
  SELF = 'SELF',
}

export class DashboardItemResponseDto {
  @ApiProperty({ example: 'onboarding_pending' })
  code!: string;

  @ApiProperty({ example: 'Organisations pending onboarding verification' })
  label!: string;

  @ApiProperty({ enum: DashboardScope })
  scope!: DashboardScope;

  @ApiProperty({ minimum: 0 })
  count!: number;
}

export class DashboardSummaryDataResponseDto {
  @ApiProperty({ type: () => [DashboardItemResponseDto] })
  items!: DashboardItemResponseDto[];
}

export class DashboardSummaryResponseDto {
  @ApiProperty({ type: () => DashboardSummaryDataResponseDto })
  data!: DashboardSummaryDataResponseDto;

  @ApiProperty({ example: '01J5EXAMPLECORRELATIONID' })
  requestId!: string;
}
