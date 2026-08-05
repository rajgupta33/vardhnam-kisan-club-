import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
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
import { CartService } from './cart.service';
import { AddCartItemDto } from './dto/add-cart-item.dto';
import { UpdateCartContextDto } from './dto/update-cart-context.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@ApiTags('cart')
@Controller('cart')
@UseGuards(MockAuthGuard, PermissionsGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @RequirePermissions(PermissionCode.CART_READ_OWN)
  getMyCart(@CurrentUserContext() actor: CurrentUser) {
    return this.cartService.getMyCart(actor);
  }

  @Patch('context')
  @RequirePermissions(PermissionCode.CART_WRITE_OWN)
  updateCartContext(
    @Body() dto: UpdateCartContextDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.cartService.updateCartContext(dto, actor, getRequestId(request));
  }

  @Post('items')
  @RequirePermissions(PermissionCode.CART_WRITE_OWN)
  addItem(
    @Body() dto: AddCartItemDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.cartService.addItem(dto, actor, getRequestId(request));
  }

  @Patch('items/:cartItemId')
  @RequirePermissions(PermissionCode.CART_WRITE_OWN)
  updateItem(
    @Param('cartItemId', ParseUUIDPipe) cartItemId: string,
    @Body() dto: UpdateCartItemDto,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.cartService.updateItem(cartItemId, dto, actor, getRequestId(request));
  }

  @Delete('items/:cartItemId')
  @RequirePermissions(PermissionCode.CART_WRITE_OWN)
  removeItem(
    @Param('cartItemId', ParseUUIDPipe) cartItemId: string,
    @CurrentUserContext() actor: CurrentUser,
    @Req() request: Request,
  ) {
    return this.cartService.removeItem(cartItemId, actor, getRequestId(request));
  }

  @Delete('items')
  @RequirePermissions(PermissionCode.CART_WRITE_OWN)
  clearCart(@CurrentUserContext() actor: CurrentUser, @Req() request: Request) {
    return this.cartService.clearCart(actor, getRequestId(request));
  }
}
