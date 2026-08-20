import type { AdvisoryCategory, AdvisoryRule } from '@vardhnam/api-client';
import { labelFromCode } from '../../lib/format';

const categories: AdvisoryCategory[] = [
  'CROP_STAGE',
  'IRRIGATION',
  'NUTRITION',
  'PEST_MONITORING',
  'DISEASE_RISK',
  'HARVEST',
  'GENERAL_PRACTICE',
];

interface AdvisoryFormProps {
  action: (formData: FormData) => Promise<void>;
  rule?: AdvisoryRule;
  submitLabel: string;
}

export function AdvisoryForm({ action, rule, submitLabel }: AdvisoryFormProps) {
  return (
    <form action={action} className="panel advisoryForm">
      {rule ? <input name="ruleId" type="hidden" value={rule.id} /> : null}
      <div className="detailGrid">
        <label>
          Crop name
          <input defaultValue={rule?.cropName} maxLength={100} minLength={2} name="cropName" required />
        </label>
        <label>
          Variety (optional)
          <input defaultValue={rule?.varietyName ?? ''} maxLength={100} name="varietyName" />
        </label>
        <label>
          Category
          <select defaultValue={rule?.category ?? 'CROP_STAGE'} name="category" required>
            {categories.map((category) => <option key={category} value={category}>{labelFromCode(category)}</option>)}
          </select>
        </label>
        <label>
          Minimum days after sowing
          <input
            defaultValue={rule?.minDaysAfterSowing ?? 0}
            max={1000}
            min={0}
            name="minDaysAfterSowing"
            required
            step={1}
            type="number"
          />
        </label>
        <label>
          Maximum days after sowing
          <input
            defaultValue={rule?.maxDaysAfterSowing ?? 30}
            max={1000}
            min={0}
            name="maxDaysAfterSowing"
            required
            step={1}
            type="number"
          />
        </label>
        <label>
          Seasons (comma separated)
          <input defaultValue={rule?.seasons.join(', ') ?? ''} name="seasons" placeholder="Kharif, Rabi" />
        </label>
        <label>
          Eligible states (comma separated)
          <input defaultValue={rule?.eligibleStates.join(', ') ?? ''} name="eligibleStates" placeholder="Maharashtra" />
        </label>
        <label>
          Eligible districts (comma separated)
          <input defaultValue={rule?.eligibleDistricts.join(', ') ?? ''} name="eligibleDistricts" placeholder="Pune, Nashik" />
        </label>
        <label>
          Source reference
          <input defaultValue={rule?.sourceReference ?? ''} maxLength={500} name="sourceReference" required />
        </label>
      </div>
      <div className="decisionGrid">
        <label>
          English title
          <input defaultValue={rule?.titleEn} maxLength={160} minLength={3} name="titleEn" required />
        </label>
        <label>
          Hindi title
          <input defaultValue={rule?.titleHi} maxLength={160} minLength={3} name="titleHi" required />
        </label>
        <label>
          English advisory
          <textarea defaultValue={rule?.bodyEn} maxLength={4000} minLength={3} name="bodyEn" required rows={7} />
        </label>
        <label>
          Hindi advisory
          <textarea defaultValue={rule?.bodyHi} lang="hi" maxLength={4000} minLength={3} name="bodyHi" required rows={7} />
        </label>
      </div>
      <label>
        Change reason (recorded in the audit log)
        <input maxLength={500} minLength={3} name="reason" required />
      </label>
      <div className="formActions">
        <button className="primaryButton" type="submit">{submitLabel}</button>
      </div>
    </form>
  );
}
