import { PlatformRole, ReturnInspectionOutcome, ReturnReasonCode } from '@prisma/client';
import { CreditNotesService } from '../src/refunds/credit-notes.service';

describe('CreditNotesService', () => {
  it('issues one gross GST credit note while keeping the farmer refund and subsidy separate', async () => {
    const tx = {
      creditNote: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'credit-note-id', ...data })),
      },
      creditNoteDocument: {
        create: jest.fn().mockResolvedValue({ id: 'credit-note-document-id' }),
      },
      creditNoteSequence: {
        upsert: jest.fn().mockResolvedValue({ lastNumber: 1 }),
      },
      refund: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'refund-id',
          amountPaise: 9_500,
          productOrderId: 'order-id',
          productOrder: {
            invoice: {
              id: 'invoice-id',
              invoiceNumber: 'ABCD/27/000001',
              generatedAt: new Date('2026-08-18T10:00:00.000Z'),
              sellerOrganisationId: '00000000-0000-4000-8000-000000000021',
              sellerLegalNameSnapshot: 'जयपुर वितरक प्राइवेट लिमिटेड',
              sellerGstinSnapshot: '08ABCDE1234F1Z5',
              sellerStateCodeSnapshot: '08',
              sellerAddressSnapshot: 'Plot 12, Jaipur, Rajasthan, 302001',
              farmerNameSnapshot: 'Demo Farmer',
              deliveryAddressSnapshot: { addressLine1: 'Farm Road', state: 'Rajasthan', pincode: '302001' },
              placeOfSupplyStateCode: '08',
              lineItemsSnapshot: [
                {
                  productOrderItemId: 'order-item-id',
                  productNameSnapshot: 'बीज',
                  variantNameSnapshot: '1 kg',
                  hsnCode: '1209',
                  gstRateBps: 500,
                },
              ],
            },
          },
          returnRequest: {
            id: 'return-id',
            reasonCode: ReturnReasonCode.DAMAGED_IN_TRANSIT,
            reasonNote: null,
            items: [
              {
                id: 'return-item-id',
                productOrderItemId: 'order-item-id',
                unitPricePaise: 10_500,
              },
            ],
            inspectionDispositions: [
              {
                returnRequestItemId: 'return-item-id',
                outcome: ReturnInspectionOutcome.RESTOCKABLE,
                quantity: 1,
              },
            ],
          },
        }),
      },
    };
    const audit = { record: jest.fn().mockResolvedValue({}) };
    const service = new CreditNotesService(
      {} as never,
      {} as never,
      audit as never,
      {} as never,
      {} as never,
      {} as never,
    );
    const actor = {
      userId: '00000000-0000-4000-8000-000000000003',
      role: PlatformRole.OPERATIONS_MANAGER,
      membershipId: 'membership-id',
      organisationId: '00000000-0000-4000-8000-000000000001',
      permissions: [],
    };

    await expect(
      service.issueForSucceededRefund(tx as never, 'refund-id', actor, 'request-id'),
    ).resolves.toBe('credit-note-document-id');

    expect(tx.creditNote.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        creditNoteNumber: 'CN0000/27/000001',
        grossCreditPaise: 10_500,
        farmerRefundPaise: 9_500,
        subsidyReversalPaise: 1_000,
        taxableAmountPaise: 10_000,
        taxPaise: 500,
        cgstPaise: 250,
        sgstPaise: 250,
        igstPaise: 0,
        originalInvoiceNumber: 'ABCD/27/000001',
      }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREDIT_NOTE_ISSUED', resourceId: 'credit-note-id' }),
      tx,
    );
  });

  it('returns the existing document without consuming another sequence', async () => {
    const tx = {
      creditNote: {
        findUnique: jest.fn().mockResolvedValue({ document: { id: 'existing-document-id' } }),
      },
    };
    const service = new CreditNotesService(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      service.issueForSucceededRefund(tx as never, 'refund-id', {
        userId: 'user-id',
        role: PlatformRole.OPERATIONS_MANAGER,
        membershipId: 'membership-id',
        organisationId: 'organisation-id',
        permissions: [],
      }),
    ).resolves.toBe('existing-document-id');
  });
});
