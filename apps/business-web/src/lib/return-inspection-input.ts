import type { InspectReturnRequestInput, ReturnInspectionOutcome } from '@vardhnam/api-client';
import { parseWholeNumberInput } from './whole-number-input';

const inspectionOutcomes: ReadonlySet<string> = new Set([
  'RESTOCKABLE',
  'DAMAGED_WRITE_OFF',
  'QUARANTINED',
  'REJECTED_RETURN',
]);

export function parseReturnInspectionDispositions(
  entries: Iterable<[string, FormDataEntryValue]>,
): InspectReturnRequestInput['dispositions'] {
  const dispositions: InspectReturnRequestInput['dispositions'] = [];

  for (const [key, rawValue] of entries) {
    if (!key.startsWith('disposition:') || typeof rawValue !== 'string') continue;

    const parts = key.split(':');
    if (parts.length !== 4) continue;
    const [, returnRequestItemId, reservationId, outcome] = parts;
    if (!returnRequestItemId || !reservationId || !outcome || !isInspectionOutcome(outcome)) continue;

    const quantity = parseWholeNumberInput(rawValue.trim() || undefined, {
      fieldName: 'Inspection quantity',
      min: 0,
    });
    if (quantity === undefined || quantity === 0) continue;

    dispositions.push({ returnRequestItemId, reservationId, outcome, quantity });
  }

  return dispositions;
}

function isInspectionOutcome(value: string): value is ReturnInspectionOutcome {
  return inspectionOutcomes.has(value);
}
