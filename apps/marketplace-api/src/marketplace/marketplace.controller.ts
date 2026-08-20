import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiErrorCode } from '../common/errors/api-error-codes';
import { ListMarketplaceProductsQueryDto } from './dto/list-marketplace-products-query.dto';
import { MarketplaceFilterOptionsQueryDto } from './dto/marketplace-filter-options-query.dto';
import { MarketplaceProductDetailQueryDto } from './dto/marketplace-product-detail-query.dto';
import { MarketplaceService } from './marketplace.service';

@ApiTags('marketplace')
@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('products')
  listProducts(@Query() query: ListMarketplaceProductsQueryDto) {
    return this.marketplaceService.listProducts(query);
  }

  @Get('products/filter-options')
  getFilterOptions(@Query() query: MarketplaceFilterOptionsQueryDto) {
    return this.marketplaceService.getFilterOptions(query);
  }

  @Get('products/:productId')
  getProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: MarketplaceProductDetailQueryDto,
  ) {
    return this.marketplaceService.getProduct(productId, query);
  }

  @Get('products/:productId/image')
  @ApiOperation({
    summary: 'Redirect to the product pack shot',
    description:
      'Stable public URL. Discovery results are cached on device for 24 hours, so the image link must not expire; this endpoint mints a fresh short-lived storage URL per request. Product photography is public marketing material, unlike the permission-checked downloads under /files.',
  })
  async getProductImage(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Res() response: Response,
  ): Promise<void> {
    const target = await this.marketplaceService.getProductImageTarget(productId);

    if (!target) {
      throw new NotFoundException({
        code: ApiErrorCode.NOT_FOUND,
        message: 'Product image not found',
      });
    }

    // 302 rather than 301: the storage URL behind it changes every time, and a
    // permanently cached redirect would pin a client to an expired signature.
    response.redirect(302, target);
  }
}
