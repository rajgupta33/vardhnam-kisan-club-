import { ApiProperty } from '@nestjs/swagger';
import {
  MembershipStatus,
  OrganisationStatus,
  OrganisationType,
  PlatformRole,
  UserStatus,
} from '@prisma/client';

export class OrganisationUserProfileResponseDto {
  @ApiProperty()
  displayName!: string;
}

export class OrganisationUserIdentityResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  email!: string | null;

  @ApiProperty({ type: String, nullable: true })
  phone!: string | null;

  @ApiProperty({ enum: UserStatus })
  status!: UserStatus;

  @ApiProperty({ type: () => OrganisationUserProfileResponseDto, nullable: true })
  profile!: OrganisationUserProfileResponseDto | null;
}

export class OrganisationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: OrganisationType })
  type!: OrganisationType;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  legalName!: string;

  @ApiProperty()
  displayName!: string;

  @ApiProperty({ type: String, nullable: true })
  gstin!: string | null;

  @ApiProperty({ type: String, nullable: true })
  registeredStateCode!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  gstinVerifiedAt!: string | null;

  @ApiProperty({ enum: OrganisationStatus })
  status!: OrganisationStatus;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  reviewedAt!: string | null;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  reviewedByUserId!: string | null;

  @ApiProperty({ type: () => OrganisationUserIdentityResponseDto, nullable: true })
  reviewedBy!: OrganisationUserIdentityResponseDto | null;

  @ApiProperty({ type: String, nullable: true })
  reviewReason!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;
}

export class OrganisationMembershipResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  userId!: string;

  @ApiProperty({ format: 'uuid' })
  organisationId!: string;

  @ApiProperty({ enum: PlatformRole })
  role!: PlatformRole;

  @ApiProperty({ enum: MembershipStatus })
  status!: MembershipStatus;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: () => OrganisationUserIdentityResponseDto })
  user!: OrganisationUserIdentityResponseDto;
}

export class OrganisationDetailResponseDto extends OrganisationResponseDto {
  @ApiProperty({ type: () => [OrganisationMembershipResponseDto] })
  memberships!: OrganisationMembershipResponseDto[];
}

export class OrganisationPageDataResponseDto {
  @ApiProperty({ type: () => [OrganisationResponseDto] })
  items!: OrganisationResponseDto[];

  @ApiProperty({ minimum: 1 })
  page!: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  limit!: number;

  @ApiProperty({ minimum: 0 })
  total!: number;
}

export class OrganisationPageResponseDto {
  @ApiProperty({ type: () => OrganisationPageDataResponseDto })
  data!: OrganisationPageDataResponseDto;

  @ApiProperty({ example: '01J5EXAMPLECORRELATIONID' })
  requestId!: string;
}

export class OrganisationDetailResponseEnvelopeDto {
  @ApiProperty({ type: () => OrganisationDetailResponseDto })
  data!: OrganisationDetailResponseDto;

  @ApiProperty({ example: '01J5EXAMPLECORRELATIONID' })
  requestId!: string;
}
