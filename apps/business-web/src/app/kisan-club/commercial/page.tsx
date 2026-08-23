import type {
  KisanClubBenefitRule,
  KisanClubBenefitStatus,
  KisanClubBenefitType,
  KisanClubProductProgramme,
  KisanClubProgrammeOption,
  KisanClubProgrammeStatus,
} from '@vardhnam/api-client';
import { BusinessShell } from '../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../components/confirm-submit-button';
import { EmptyState } from '../../../components/empty-state';
import { Pagination } from '../../../components/pagination';
import { StatusBadge } from '../../../components/status-badge';
import { readPortalSession } from '../../../lib/auth-session';
import { formatDateTime, labelFromCode } from '../../../lib/format';
import {
  loadKisanClubBenefitRules,
  loadKisanClubProgrammeOptions,
  loadKisanClubProgrammes,
} from '../../../lib/marketplace-api';
import {
  createBenefitRuleAction,
  createProgrammeAction,
  updateBenefitRuleAction,
  updateProgrammeAction,
} from './actions';

export const dynamic = 'force-dynamic';
type SearchParams = Record<string, string | string[] | undefined>;
const programmeStatuses: KisanClubProgrammeStatus[] = ['DRAFT', 'ACTIVE', 'PAUSED', 'ENDED'];
// Matches the other Kisan Club queues. Both lists page independently.
const listLimit = 25;
const benefitStatuses: KisanClubBenefitStatus[] = ['DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED'];
const benefitTypes: KisanClubBenefitType[] = [
  'FLAT_AMOUNT_OFF',
  'PERCENT_OFF',
  'QUANTITY_THRESHOLD',
];

export default async function KisanClubCommercialPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const session = await readPortalSession();
  const permissions = new Set(session?.permissions ?? []);
  const canManageProgrammes = permissions.has('kisan-club-programmes:manage');
  const canManageBenefits = permissions.has('kisan-club-benefits:manage');
  const programmeStatus = parseAllowed(readParam(params.programmeStatus), programmeStatuses);
  const productId = readParam(params.productId)?.trim() || undefined;
  const benefitStatus = parseAllowed(readParam(params.benefitStatus), benefitStatuses);
  const programmeId = readParam(params.programmeId)?.trim() || undefined;
  const programmePage = positiveInteger(readParam(params.programmePage), 1);
  const benefitPage = positiveInteger(readParam(params.benefitPage), 1);

  // The third request is the complete programme list that the benefit filter
  // and create form select from. Sharing the paged programme queue meant
  // filtering it to ACTIVE made a DRAFT programme unselectable, and anything
  // past the page size silently disappeared -- on a form whose output is a
  // pricing rule.
  const [programmeResult, benefitResult, programmeOptionsResult] = await Promise.all([
    canManageProgrammes
      ? loadKisanClubProgrammes({
          ...(programmeStatus ? { status: programmeStatus } : {}),
          ...(productId ? { productId } : {}),
          page: programmePage,
          limit: listLimit,
        })
      : Promise.resolve(null),
    canManageBenefits
      ? loadKisanClubBenefitRules({
          ...(benefitStatus ? { status: benefitStatus } : {}),
          ...(programmeId ? { programmeId } : {}),
          page: benefitPage,
          limit: listLimit,
        })
      : Promise.resolve(null),
    canManageProgrammes || canManageBenefits
      ? loadKisanClubProgrammeOptions()
      : Promise.resolve(null),
  ]);
  const programmes = programmeResult?.ok ? programmeResult.data.items : [];
  const rules = benefitResult?.ok ? benefitResult.data.items : [];
  const programmeOptions = programmeOptionsResult?.ok ? programmeOptionsResult.data.items : [];

  return (
    <BusinessShell
      active="kisanCommercial"
      eyebrow="Kisan Club commercial controls"
      statuses={[
        {
          label: programmeResult?.ok
            ? `${programmeResult.data.total} programmes`
            : 'Programmes restricted',
          tone: programmeResult?.ok ? 'ok' : 'warn',
        },
        {
          label: benefitResult?.ok
            ? `${benefitResult.data.total} benefit rules`
            : 'Benefits restricted',
          tone: benefitResult?.ok ? 'ok' : 'warn',
        },
      ]}
      title="Programmes and Benefits"
    >
      {readParam(params.notice) ? (
        <p className="noticeBanner ok">{readParam(params.notice)}</p>
      ) : null}
      {readParam(params.error) ? (
        <p className="noticeBanner danger">{readParam(params.error)}</p>
      ) : null}
      <section className="panel">
        <p className="eyebrow">Financial boundary</p>
        <p className="mutedText">
          All eligibility and paise calculations are performed by the API. Activating a benefit
          requires an active programme; redeemed rules cannot change financial or eligibility terms.
        </p>
      </section>
      {canManageProgrammes ? (
        <ProgrammeWorkspace
          buildPageHref={(target) => workspaceHref(params, { programmePage: String(target) })}
          error={programmeResult && !programmeResult.ok ? programmeResult.error : undefined}
          page={programmePage}
          productId={productId}
          programmes={programmes}
          selectedStatus={programmeStatus}
          total={programmeResult?.ok ? programmeResult.data.total : 0}
        />
      ) : null}
      {canManageBenefits ? (
        <BenefitWorkspace
          buildPageHref={(target) => workspaceHref(params, { benefitPage: String(target) })}
          error={benefitResult && !benefitResult.ok ? benefitResult.error : undefined}
          page={benefitPage}
          programmes={programmeOptions}
          rules={rules}
          selectedProgrammeId={programmeId}
          selectedStatus={benefitStatus}
          total={benefitResult?.ok ? benefitResult.data.total : 0}
        />
      ) : null}
    </BusinessShell>
  );
}

function ProgrammeWorkspace({
  programmes,
  selectedStatus,
  productId,
  error,
  page,
  total,
  buildPageHref,
}: {
  programmes: KisanClubProductProgramme[];
  selectedStatus?: KisanClubProgrammeStatus | undefined;
  productId?: string | undefined;
  error?: string | undefined;
  page: number;
  total: number;
  buildPageHref: (page: number) => string;
}) {
  return (
    <>
      <section className="panel">
        <div className="rowHeader">
          <div>
            <p className="eyebrow">Approved Vardhnam catalogue only</p>
            <h3>Product programmes</h3>
          </div>
        </div>
        <form className="filterForm" method="get">
          <label>
            Product UUID
            <input defaultValue={productId ?? ''} name="productId" />
          </label>
          <label>
            Status
            <select defaultValue={selectedStatus ?? ''} name="programmeStatus">
              <option value="">All statuses</option>
              {programmeStatuses.map((status) => (
                <option key={status} value={status}>
                  {labelFromCode(status)}
                </option>
              ))}
            </select>
          </label>
          <button className="queueAction" type="submit">
            Filter programmes
          </button>
        </form>
      </section>
      <ProgrammeCreateForm />
      {error ? (
        <EmptyState description={error} title="Unable to load programmes" />
      ) : programmes.length === 0 ? (
        <EmptyState
          description="Change the programme filters or create a new draft."
          title="No programmes match"
        />
      ) : (
        <section className="queueList" aria-label="Kisan Club programmes">
          {programmes.map((programme) => (
            <ProgrammeEditForm key={programme.id} programme={programme} />
          ))}
        </section>
      )}
      {error ? null : (
        <Pagination buildHref={buildPageHref} limit={listLimit} page={page} total={total} />
      )}
    </>
  );
}

function ProgrammeCreateForm() {
  return (
    <form action={createProgrammeAction} className="panel rejectForm">
      <div>
        <p className="eyebrow">New draft</p>
        <h3>Enrol Vardhnam product</h3>
      </div>
      <label>
        Product UUID
        <input name="productId" required />
      </label>
      <label>
        Variant UUID (optional)
        <input name="variantId" />
      </label>
      <label>
        Starts at — UTC ISO
        <input name="startsAt" placeholder="2026-09-01T00:00:00.000Z" required />
      </label>
      <label>
        Ends at — UTC ISO (optional)
        <input name="endsAt" />
      </label>
      <label>
        Eligible pincodes
        <input name="eligiblePincodes" placeholder="207001, 207002" />
      </label>
      <label>
        Eligible districts
        <input name="eligibleDistricts" placeholder="Etah, Agra" />
      </label>
      <label>
        Display priority
        <input
          defaultValue={0}
          max={10000}
          min={-10000}
          name="displayPriority"
          required
          step={1}
          type="number"
        />
      </label>
      <label>
        Reason
        <input maxLength={500} minLength={3} name="reason" required />
      </label>
      <ConfirmSubmitButton confirmMessage="Create this Kisan Club product programme draft?">
        Create programme draft
      </ConfirmSubmitButton>
    </form>
  );
}

function ProgrammeEditForm({ programme }: { programme: KisanClubProductProgramme }) {
  return (
    <form action={updateProgrammeAction} className="panel rejectForm">
      <div className="rowHeader">
        <div>
          <p className="eyebrow">{programme.product.brand?.name ?? 'Vardhnam product'}</p>
          <h3>
            {programme.product.name}
            {programme.variant ? ` / ${programme.variant.variantName}` : ''}
          </h3>
          <p className="mutedText">Programme {programme.id}</p>
        </div>
        <StatusBadge label={labelFromCode(programme.status)} tone={statusTone(programme.status)} />
      </div>
      <input name="programmeId" type="hidden" value={programme.id} />
      <label>
        Status
        <select defaultValue={programme.status} name="status">
          {programmeStatuses.map((status) => (
            <option key={status} value={status}>
              {labelFromCode(status)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Starts at — UTC ISO
        <input defaultValue={programme.startsAt} name="startsAt" required />
      </label>
      <label>
        Ends at — UTC ISO
        <input defaultValue={programme.endsAt ?? ''} name="endsAt" />
      </label>
      <label>
        Eligible pincodes
        <input defaultValue={programme.eligiblePincodes.join(', ')} name="eligiblePincodes" />
      </label>
      <label>
        Eligible districts
        <input defaultValue={programme.eligibleDistricts.join(', ')} name="eligibleDistricts" />
      </label>
      <label>
        Display priority
        <input
          defaultValue={programme.displayPriority}
          max={10000}
          min={-10000}
          name="displayPriority"
          required
          step={1}
          type="number"
        />
      </label>
      <label>
        Audit reason
        <input
          defaultValue={programme.reason ?? ''}
          maxLength={500}
          minLength={3}
          name="reason"
          required
        />
      </label>
      <p className="mutedText">
        Ended programmes are immutable. Status transitions are enforced by the API.
      </p>
      <ConfirmSubmitButton confirmMessage="Save these programme status, eligibility, and schedule changes?">
        Save programme
      </ConfirmSubmitButton>
    </form>
  );
}

function BenefitWorkspace({
  rules,
  programmes,
  selectedStatus,
  selectedProgrammeId,
  error,
  page,
  total,
  buildPageHref,
}: {
  rules: KisanClubBenefitRule[];
  /** The complete programme list, never the paged management queue. */
  programmes: KisanClubProgrammeOption[];
  selectedStatus?: KisanClubBenefitStatus | undefined;
  selectedProgrammeId?: string | undefined;
  error?: string | undefined;
  page: number;
  total: number;
  buildPageHref: (page: number) => string;
}) {
  return (
    <>
      <section className="panel">
        <div className="rowHeader">
          <div>
            <p className="eyebrow">Platform-funded benefit controls</p>
            <h3>Benefit rules</h3>
          </div>
        </div>
        <form className="filterForm" method="get">
          <label>
            Programme
            <select defaultValue={selectedProgrammeId ?? ''} name="programmeId">
              <option value="">All programmes</option>
              {programmes.map((programme) => (
                <option key={programme.id} value={programme.id}>
                  {programmeOptionLabel(programme)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select defaultValue={selectedStatus ?? ''} name="benefitStatus">
              <option value="">All statuses</option>
              {benefitStatuses.map((status) => (
                <option key={status} value={status}>
                  {labelFromCode(status)}
                </option>
              ))}
            </select>
          </label>
          <button className="queueAction" type="submit">
            Filter benefits
          </button>
        </form>
      </section>
      <BenefitCreateForm programmes={programmes} />
      {error ? (
        <EmptyState description={error} title="Unable to load benefit rules" />
      ) : rules.length === 0 ? (
        <EmptyState
          description="Change the benefit filters or create a new draft."
          title="No benefit rules match"
        />
      ) : (
        <section className="queueList" aria-label="Kisan Club benefit rules">
          {rules.map((rule) => (
            <BenefitEditForm key={rule.id} rule={rule} />
          ))}
        </section>
      )}
      {error ? null : (
        <Pagination buildHref={buildPageHref} limit={listLimit} page={page} total={total} />
      )}
    </>
  );
}

function BenefitCreateForm({ programmes }: { programmes: KisanClubProgrammeOption[] }) {
  return (
    <form action={createBenefitRuleAction} className="panel rejectForm">
      <div>
        <p className="eyebrow">New financial rule</p>
        <h3>Create benefit draft</h3>
      </div>
      {programmes.length > 0 ? (
        <label>
          Programme
          <select name="programmeId" required>
            <option value="">Select programme</option>
            {programmes.map((programme) => (
              <option key={programme.id} value={programme.id}>
                {programmeOptionLabel(programme)}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label>
          Programme UUID
          <input name="programmeId" required />
        </label>
      )}
      <BenefitEconomicFields />
      <label>
        Reason
        <input maxLength={500} minLength={3} name="reason" required />
      </label>
      <ConfirmSubmitButton confirmMessage="Create this platform-funded benefit-rule draft with the entered financial terms?">
        Create benefit draft
      </ConfirmSubmitButton>
    </form>
  );
}

function BenefitEditForm({ rule }: { rule: KisanClubBenefitRule }) {
  const editable = rule.usageCount === 0 && rule.status !== 'EXPIRED';
  return (
    <form action={updateBenefitRuleAction} className="panel rejectForm">
      <div className="rowHeader">
        <div>
          <p className="eyebrow">{rule.programme.product.name}</p>
          <h3>{labelFromCode(rule.benefitType)}</h3>
          <p className="mutedText">
            Used {rule.usageCount} times · created {formatDateTime(rule.createdAt)}
          </p>
        </div>
        <StatusBadge label={labelFromCode(rule.status)} tone={statusTone(rule.status)} />
      </div>
      <input name="ruleId" type="hidden" value={rule.id} />
      <input name="economicEditable" type="hidden" value={String(editable)} />
      <label>
        Status
        <select defaultValue={rule.status} name="status">
          {benefitStatuses.map((status) => (
            <option key={status} value={status}>
              {labelFromCode(status)}
            </option>
          ))}
        </select>
      </label>
      {editable ? (
        <BenefitEconomicFields rule={rule} />
      ) : (
        <dl className="definitionGrid threeColumn">
          <Detail label="Value" value={benefitValue(rule)} />
          <Detail label="Minimum quantity" value={String(rule.minimumQuantity)} />
          <Detail
            label="Usage"
            value={`${rule.usageCount}${rule.totalUsageLimit ? ` / ${rule.totalUsageLimit}` : ''}`}
          />
        </dl>
      )}
      <label>
        Audit reason
        <input
          defaultValue={rule.reason ?? ''}
          maxLength={500}
          minLength={3}
          name="reason"
          required
        />
      </label>
      <p className="mutedText">
        {editable
          ? 'Financial terms remain editable only before the first redemption.'
          : 'Financial and eligibility terms are locked because this rule has redemptions or is expired.'}
      </p>
      <ConfirmSubmitButton confirmMessage="Save this benefit rule? The backend will reject locked financial or eligibility changes after redemption.">
        Save benefit rule
      </ConfirmSubmitButton>
    </form>
  );
}

function BenefitEconomicFields({ rule }: { rule?: KisanClubBenefitRule }) {
  return (
    <>
      <label>
        Benefit type
        <select defaultValue={rule?.benefitType ?? 'FLAT_AMOUNT_OFF'} name="benefitType">
          {benefitTypes.map((type) => (
            <option key={type} value={type}>
              {labelFromCode(type)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Flat amount per unit — paise
        <input
          defaultValue={rule?.flatAmountPaise ?? ''}
          min={1}
          name="flatAmountPaise"
          step={1}
          type="number"
        />
      </label>
      <label>
        Percent — basis points
        <input
          defaultValue={rule?.percentBps ?? ''}
          max={10000}
          min={1}
          name="percentBps"
          step={1}
          type="number"
        />
      </label>
      <label>
        Maximum benefit — paise
        <input
          defaultValue={rule?.maxBenefitPaise ?? ''}
          min={1}
          name="maxBenefitPaise"
          step={1}
          type="number"
        />
      </label>
      <label>
        Minimum quantity
        <input
          defaultValue={rule?.minimumQuantity ?? 1}
          min={1}
          name="minimumQuantity"
          required
          step={1}
          type="number"
        />
      </label>
      <label>
        Eligible pincodes
        <input defaultValue={rule?.eligiblePincodes.join(', ') ?? ''} name="eligiblePincodes" />
      </label>
      <label>
        Eligible crop UUIDs
        <input defaultValue={rule?.eligibleCropIds.join(', ') ?? ''} name="eligibleCropIds" />
      </label>
      <label>
        Starts at — UTC ISO
        <input defaultValue={rule?.startsAt ?? ''} name="startsAt" required />
      </label>
      <label>
        Ends at — UTC ISO
        <input defaultValue={rule?.endsAt ?? ''} name="endsAt" />
      </label>
      <label>
        Total usage limit
        <input
          defaultValue={rule?.totalUsageLimit ?? ''}
          min={1}
          name="totalUsageLimit"
          step={1}
          type="number"
        />
      </label>
      <label>
        Per-member usage limit
        <input
          defaultValue={rule?.perMemberUsageLimit ?? ''}
          min={1}
          name="perMemberUsageLimit"
          step={1}
          type="number"
        />
      </label>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function benefitValue(rule: KisanClubBenefitRule): string {
  return rule.percentBps ? `${rule.percentBps} bps` : `${rule.flatAmountPaise ?? 0} paise per unit`;
}
function statusTone(status: string): 'ok' | 'warn' | 'danger' {
  return status === 'ACTIVE'
    ? 'ok'
    : status === 'ENDED' || status === 'EXPIRED'
      ? 'danger'
      : 'warn';
}
/**
 * How a programme is named in a selector.
 *
 * A programme has no name of its own, so it is identified by the product it
 * covers. The variant is included when there is one, because two programmes
 * over different pack sizes of the same product are otherwise identical on
 * screen. The id fragment stays as the final tie-breaker.
 */
function programmeOptionLabel(programme: KisanClubProgrammeOption): string {
  const product = programme.variantName
    ? `${programme.productName} (${programme.variantName})`
    : programme.productName;
  return `${product} — ${programme.id.slice(0, 8)}`;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Rebuilds this page URL with one page parameter changed, so paging the
 * programme list does not reset where the benefit list was, or vice versa.
 */
function workspaceHref(params: SearchParams, overrides: Record<string, string>): string {
  const query = new URLSearchParams();
  for (const key of [
    'programmeStatus',
    'productId',
    'benefitStatus',
    'programmeId',
    'programmePage',
    'benefitPage',
  ]) {
    const value = readParam(params[key]);
    if (value) query.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) query.set(key, value);
  return `/kisan-club/commercial?${query.toString()}`;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
function parseAllowed<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return value && allowed.includes(value as T) ? (value as T) : undefined;
}
