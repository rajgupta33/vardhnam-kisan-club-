import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MockPaymentProvider } from './providers/mock-payment.provider';
import { PaymentProviderRegistry } from './providers/payment-provider.registry';

/**
 * The gateway layer on its own, depending on nothing but configuration and
 * Prisma.
 *
 * `RefundsModule` needs a provider to execute refunds, and `PaymentsModule`
 * already imports enough of the graph that importing it from refunds would
 * close a loop. Keeping the providers in a leaf module lets both import it
 * without a `forwardRef` -- the same shape `NotificationTransportModule` takes
 * for the same reason.
 */
@Module({
  imports: [PrismaModule],
  providers: [MockPaymentProvider, PaymentProviderRegistry],
  exports: [MockPaymentProvider, PaymentProviderRegistry],
})
export class PaymentProviderModule {}
