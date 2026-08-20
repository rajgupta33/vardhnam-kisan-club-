import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { CurrentUserContext } from './current-user.decorator';
import type { CurrentUser } from './current-user.interface';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestOtpDto } from './dto/request-otp.dto';
import { SelectOrganisationDto } from './dto/select-organisation.dto';
import { VerifyFarmerOtpDto } from './dto/verify-farmer-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenContextParam } from './refresh-token-context.decorator';
import type { RefreshTokenContext } from './refresh-token.guard';
import { RefreshTokenGuard } from './refresh-token.guard';
import { MockAuthGuard } from './mock-auth.guard';

function requestMeta(request: Request): { userAgent?: string; ip?: string } {
  const userAgent = request.get('user-agent');
  return {
    ...(userAgent ? { userAgent } : {}),
    ...(request.ip ? { ip: request.ip } : {}),
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('session')
  @UseGuards(MockAuthGuard)
  session(@CurrentUserContext() actor: CurrentUser) {
    return actor;
  }

  @Post('otp/request')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestOtp(@Body() dto: RequestOtpDto, @Req() request: Request) {
    return this.authService.requestOtp(dto, getRequestId(request), request.ip);
  }

  @Post('farmer/otp/request')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  requestFarmerOtp(@Body() dto: RequestOtpDto, @Req() request: Request) {
    return this.authService.requestFarmerOtp(dto, getRequestId(request), request.ip);
  }

  @Post('otp/verify')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyOtp(@Body() dto: VerifyOtpDto, @Req() request: Request) {
    return this.authService.verifyOtp(dto, getRequestId(request), requestMeta(request));
  }

  @Post('farmer/otp/verify')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  verifyFarmerOtp(@Body() dto: VerifyFarmerOtpDto, @Req() request: Request) {
    return this.authService.verifyFarmerOtp(dto, getRequestId(request), requestMeta(request));
  }

  @Post('login')
  @HttpCode(200)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Req() request: Request) {
    return this.authService.login(dto, getRequestId(request), requestMeta(request));
  }

  @Post('select-organisation')
  @HttpCode(200)
  selectOrganisation(@Body() dto: SelectOrganisationDto, @Req() request: Request) {
    return this.authService.selectOrganisation(dto, getRequestId(request), requestMeta(request));
  }

  @Post('refresh')
  @HttpCode(200)
  @UseGuards(RefreshTokenGuard)
  refresh(
    @Body() _dto: RefreshTokenDto,
    @RefreshTokenContextParam() context: RefreshTokenContext,
    @Req() request: Request,
  ) {
    return this.authService.refresh(context, getRequestId(request), requestMeta(request));
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(RefreshTokenGuard)
  async logout(
    @Body() _dto: RefreshTokenDto,
    @RefreshTokenContextParam() context: RefreshTokenContext,
    @Req() request: Request,
  ) {
    await this.authService.logout(context, getRequestId(request));
    return { loggedOut: true };
  }
}
