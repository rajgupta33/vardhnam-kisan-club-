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
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { PermissionCode } from '../access/permission-codes';
import { PermissionsGuard } from '../access/permissions.guard';
import { RequirePermissions } from '../access/require-permissions.decorator';
import { CurrentUserContext } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.interface';
import { MockAuthGuard } from '../auth/mock-auth.guard';
import { getRequestId } from '../common/middleware/correlation-id.middleware';
import { CreateOfferDto } from './dto/create-offer.dto';
import { ListOffersQueryDto } from './dto/list-offers-query.dto';
import { OfferStatusOperationDto } from './dto/offer-status-operation.dto';
import { ReviewOfferDto } from './dto/review-offer.dto';
import { SubmitOfferDto } from './dto/submit-offer.dto';
import { UpdateOfferDto } from './dto/update-offer.dto';
import { OffersService } from './offers.service';

@ApiTags('offers')
@Controller('offers')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class OffersController {
  constructor(private readonly offersService: OffersService) {}

  @Get()
  listOffers(@Query() query: ListOffersQueryDto, @CurrentUserContext() actor: CurrentUser) {
    return this.offersService.listOffers(query, actor);
  }

  @Get('review-queue')
  @RequirePermissions(PermissionCode.OFFERS_QUEUE_READ)
  listOfferReviewQueue(@Query() query: ListOffersQueryDto) {
    return this.offersService.listOfferReviewQueue(query);
  }

  @Post()
  createOffer(
    @Body() dto: CreateOfferDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.offersService.createOffer(dto, actor, getRequestId(request));
  }

  @Get(':offerId')
  getOffer(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.offersService.getOffer(offerId, actor);
  }

  @Patch(':offerId')
  updateOffer(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: UpdateOfferDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.offersService.updateOffer(offerId, dto, actor, getRequestId(request));
  }

  @Post(':offerId/submit')
  submitOffer(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: SubmitOfferDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.offersService.submitOffer(offerId, dto, actor, getRequestId(request));
  }

  @Post(':offerId/pause')
  pauseOffer(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: OfferStatusOperationDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.offersService.pauseOffer(offerId, dto, actor, getRequestId(request));
  }

  @Post(':offerId/reactivate')
  reactivateOffer(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: OfferStatusOperationDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.offersService.reactivateOffer(offerId, dto, actor, getRequestId(request));
  }

  @Post(':offerId/archive')
  archiveOffer(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: OfferStatusOperationDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.offersService.archiveOffer(offerId, dto, actor, getRequestId(request));
  }

  @Post(':offerId/review')
  @RequirePermissions(PermissionCode.OFFERS_REVIEW)
  reviewOffer(
    @Param('offerId', ParseUUIDPipe) offerId: string,
    @Body() dto: ReviewOfferDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.offersService.reviewOffer(offerId, dto, actor, getRequestId(request));
  }
}
