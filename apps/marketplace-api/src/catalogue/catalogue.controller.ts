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
import { CatalogueService } from './catalogue.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { CreateProductDocumentDto } from './dto/create-product-document.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { ListCatalogueQueryDto } from './dto/list-catalogue-query.dto';
import { ReviewCatalogueItemDto } from './dto/review-catalogue-item.dto';
import { SubmitCatalogueItemDto } from './dto/submit-catalogue-item.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';

@ApiTags('catalogue')
@Controller('catalogue')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class CatalogueController {
  constructor(private readonly catalogueService: CatalogueService) {}

  @Get('brands')
  listBrands(@Query() query: ListCatalogueQueryDto, @CurrentUserContext() actor: CurrentUser) {
    return this.catalogueService.listBrands(query, actor);
  }

  @Get('brands/review-queue')
  @RequirePermissions(PermissionCode.CATALOGUE_QUEUE_READ)
  listBrandReviewQueue(@Query() query: ListCatalogueQueryDto) {
    return this.catalogueService.listBrandReviewQueue(query);
  }

  @Post('brands')
  createBrand(
    @Body() dto: CreateBrandDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.catalogueService.createBrand(dto, actor, getRequestId(request));
  }

  @Get('brands/:brandId')
  getBrand(
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.catalogueService.getBrand(brandId, actor);
  }

  @Patch('brands/:brandId')
  updateBrand(
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @Body() dto: UpdateBrandDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.catalogueService.updateBrand(brandId, dto, actor, getRequestId(request));
  }

  @Post('brands/:brandId/submit')
  submitBrand(
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @Body() dto: SubmitCatalogueItemDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.catalogueService.submitBrand(brandId, dto, actor, getRequestId(request));
  }

  @Post('brands/:brandId/review')
  @RequirePermissions(PermissionCode.CATALOGUE_REVIEW)
  reviewBrand(
    @Param('brandId', ParseUUIDPipe) brandId: string,
    @Body() dto: ReviewCatalogueItemDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.catalogueService.reviewBrand(brandId, dto, actor, getRequestId(request));
  }

  @Get('products')
  listProducts(@Query() query: ListCatalogueQueryDto, @CurrentUserContext() actor: CurrentUser) {
    return this.catalogueService.listProducts(query, actor);
  }

  @Get('products/review-queue')
  @RequirePermissions(PermissionCode.CATALOGUE_QUEUE_READ)
  listProductReviewQueue(@Query() query: ListCatalogueQueryDto) {
    return this.catalogueService.listProductReviewQueue(query);
  }

  @Post('products')
  createProduct(
    @Body() dto: CreateProductDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.catalogueService.createProduct(dto, actor, getRequestId(request));
  }

  @Get('products/:productId')
  getProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUserContext() actor: CurrentUser,
  ) {
    return this.catalogueService.getProduct(productId, actor);
  }

  @Patch('products/:productId')
  updateProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateProductDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.catalogueService.updateProduct(productId, dto, actor, getRequestId(request));
  }

  @Post('products/:productId/variants')
  addProductVariant(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateProductVariantDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.catalogueService.addProductVariant(productId, dto, actor, getRequestId(request));
  }

  @Patch('products/:productId/variants/:variantId')
  updateProductVariant(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: UpdateProductVariantDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.catalogueService.updateProductVariant(
      productId,
      variantId,
      dto,
      actor,
      getRequestId(request),
    );
  }

  @Post('products/:productId/documents')
  addProductDocument(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: CreateProductDocumentDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.catalogueService.addProductDocument(productId, dto, actor, getRequestId(request));
  }

  @Post('products/:productId/submit')
  submitProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: SubmitCatalogueItemDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.catalogueService.submitProduct(productId, dto, actor, getRequestId(request));
  }

  @Post('products/:productId/review')
  @RequirePermissions(PermissionCode.CATALOGUE_REVIEW)
  reviewProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: ReviewCatalogueItemDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.catalogueService.reviewProduct(productId, dto, actor, getRequestId(request));
  }
}
