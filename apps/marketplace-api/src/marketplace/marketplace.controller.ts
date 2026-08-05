import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ListMarketplaceProductsQueryDto } from './dto/list-marketplace-products-query.dto';
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

  @Get('products/:productId')
  getProduct(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query() query: MarketplaceProductDetailQueryDto,
  ) {
    return this.marketplaceService.getProduct(productId, query);
  }
}
