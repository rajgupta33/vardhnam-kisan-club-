export interface AdvisoryMatchInput {
  cropName: string;
  varietyName?: string | null;
  season: string;
  district?: string | null;
  state?: string | null;
  daysAfterSowing: number;
}

export interface AdvisoryMatchRule {
  cropName: string;
  varietyName?: string | null;
  eligibleDistricts: string[];
  eligibleStates: string[];
  seasons: string[];
  minDaysAfterSowing: number;
  maxDaysAfterSowing: number;
}

const normalise = (value: string | null | undefined) =>
  value?.trim().toLocaleLowerCase('en-IN') ?? '';
const includes = (values: string[], value: string | null | undefined) =>
  values.length === 0 || values.some((candidate) => normalise(candidate) === normalise(value));

export function advisoryRuleMatches(rule: AdvisoryMatchRule, input: AdvisoryMatchInput): boolean {
  return (
    normalise(rule.cropName) === normalise(input.cropName) &&
    (!rule.varietyName || normalise(rule.varietyName) === normalise(input.varietyName)) &&
    input.daysAfterSowing >= rule.minDaysAfterSowing &&
    input.daysAfterSowing <= rule.maxDaysAfterSowing &&
    includes(rule.eligibleDistricts, input.district) &&
    includes(rule.eligibleStates, input.state) &&
    includes(rule.seasons, input.season)
  );
}
