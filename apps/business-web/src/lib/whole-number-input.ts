interface WholeNumberOptions {
  fieldName: string;
  min?: number;
  max?: number;
}

export function parseWholeNumberInput(
  value: string | undefined,
  { fieldName, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER }: WholeNumberOptions,
): number | undefined {
  if (value === undefined) return undefined;
  if (!/^-?\d+$/.test(value)) {
    throw new Error(`${fieldName} must be entered as a whole decimal number`);
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${fieldName} must be a whole number from ${min} to ${max}`);
  }
  return parsed;
}
