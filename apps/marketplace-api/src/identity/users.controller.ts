import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PermissionCode } from '../access/permission-codes';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { CurrentUserContext } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.interface';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserPageResponseDto, UserResponseEnvelopeDto } from './dto/user-response.dto';
import { UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOkResponse({ type: UserPageResponseDto })
  @RequirePermissions(PermissionCode.USERS_READ_ANY)
  list(@Query() query: ListUsersQueryDto) {
    return this.usersService.list(query);
  }

  @Get(':userId')
  @ApiOkResponse({ type: UserResponseEnvelopeDto })
  @RequirePermissions(PermissionCode.USERS_READ_ANY)
  getById(@Param('userId', ParseUUIDPipe) userId: string) {
    return this.usersService.getById(userId);
  }

  @Post()
  @ApiCreatedResponse({ type: UserResponseEnvelopeDto })
  @RequirePermissions(PermissionCode.USERS_CREATE)
  create(
    @Body() dto: CreateUserDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.usersService.create(dto, actor, getRequestId(request));
  }

  @Patch(':userId')
  @ApiOkResponse({ type: UserResponseEnvelopeDto })
  @RequirePermissions(PermissionCode.USERS_UPDATE_ANY)
  update(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.usersService.update(userId, dto, actor, getRequestId(request));
  }
}
