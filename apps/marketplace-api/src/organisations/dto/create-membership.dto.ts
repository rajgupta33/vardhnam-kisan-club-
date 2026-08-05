import { ApiProperty } from '@nestjs/swagger';
import { MembershipStatus, PlatformRole } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class CreateMembershipDto {
  @ApiProperty()
  @IsUUID()
  userId!: string;

  @ApiProperty({ enum: PlatformRole })
  @IsEnum(PlatformRole)
  role!: PlatformRole;

  @ApiProperty({ enum: MembershipStatus, required: false })
  @IsOptional()
  @IsEnum(MembershipStatus)
  status?: MembershipStatus;
}
