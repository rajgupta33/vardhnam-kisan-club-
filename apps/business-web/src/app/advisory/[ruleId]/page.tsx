import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AdvisoryRule } from '@vardhnam/api-client';
import { BusinessShell } from '../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../components/confirm-submit-button';
import { EmptyState } from '../../../components/empty-state';
import { StatusBadge } from '../../../components/status-badge';
import { readPortalSession } from '../../../lib/auth-session';
import { formatDateTime, labelFromCode } from '../../../lib/format';
import { loadAdvisoryRule } from '../../../lib/marketplace-api';
import { AdvisoryForm } from '../advisory-form';
import {
  archiveAdvisoryRuleAction,
  reviewAdvisoryRuleAction,
  submitAdvisoryRuleAction,
  updateAdvisoryRuleAction,
} from '../actions';

type SearchParams = Record<string, string | string[] | undefined>;
interface AdvisoryDetailPageProps {
  params: Promise<{ ruleId: string }>;
  searchParams?: Promise<SearchParams>;
}

export default async function AdvisoryDetailPage({
  params,
  searchParams,
}: AdvisoryDetailPageProps) {
  const [{ ruleId }, query, session] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as SearchParams),
    readPortalSession(),
  ]);
  const result = await loadAdvisoryRule(ruleId);
  if (!result.ok && result.error.toLowerCase().includes('not found')) notFound();
  const rule = result.ok ? result.data : undefined;
  const canReview = session?.permissions.includes('advisory-rules:review') ?? false;

  return (
    <BusinessShell
      active="advisory"
      eyebrow="Advisory governance"
      statuses={[
        {
          label: rule ? labelFromCode(rule.status) : 'API unavailable',
          tone:
            rule?.status === 'APPROVED' ? 'ok' : rule?.status === 'REJECTED' ? 'danger' : 'warn',
        },
      ]}
      title={rule?.titleEn ?? 'Advisory Rule'}
    >
      {readParam(query.notice) ? (
        <p className="noticeBanner ok">{readParam(query.notice)}</p>
      ) : null}
      {readParam(query.error) ? (
        <p className="noticeBanner danger">{readParam(query.error)}</p>
      ) : null}
      <div className="breadcrumbRow">
        <Link className="textLink" href="/advisory">
          Back to rules
        </Link>
      </div>
      {!rule ? (
        <EmptyState
          description={result.ok ? 'The advisory rule could not be loaded.' : result.error}
          title="Advisory API unavailable"
        />
      ) : (
        <AdvisoryDetail rule={rule} canReview={canReview} />
      )}
    </BusinessShell>
  );
}

function AdvisoryDetail({ rule, canReview }: { rule: AdvisoryRule; canReview: boolean }) {
  const editable =
    rule.status === 'DRAFT' || rule.status === 'REJECTED' || rule.status === 'APPROVED';
  return (
    <>
      <section className="panel">
        <div className="rowHeader">
          <div>
            <p className="eyebrow">Version {rule.version}</p>
            <h3>{rule.titleEn}</h3>
            <p lang="hi">{rule.titleHi}</p>
          </div>
          <StatusBadge label={labelFromCode(rule.status)} tone={advisoryStatusTone(rule.status)} />
        </div>
        <dl className="definitionGrid threeColumn">
          <Detail
            label="Crop"
            value={`${rule.cropName}${rule.varietyName ? ` / ${rule.varietyName}` : ''}`}
          />
          <Detail label="Category" value={labelFromCode(rule.category)} />
          <Detail
            label="Crop window"
            value={`${rule.minDaysAfterSowing}-${rule.maxDaysAfterSowing} days after sowing`}
          />
          <Detail label="States" value={rule.eligibleStates.join(', ') || 'All'} />
          <Detail label="Districts" value={rule.eligibleDistricts.join(', ') || 'All'} />
          <Detail label="Seasons" value={rule.seasons.join(', ') || 'All'} />
          <Detail label="Source" value={rule.sourceReference ?? 'Not recorded'} />
          <Detail label="Reviewed" value={formatDateTime(rule.reviewedAt)} />
          <Detail label="Review reason" value={rule.reviewReason ?? 'Not recorded'} />
        </dl>
      </section>

      {rule.status === 'DRAFT' ? (
        <OperationForm
          action={submitAdvisoryRuleAction}
          ruleId={rule.id}
          button="Submit for review"
          placeholder="Why this rule is ready for review"
        />
      ) : null}
      {rule.status === 'PENDING_REVIEW' && canReview ? (
        <section className="panel">
          <p className="eyebrow">Independent review</p>
          <div className="decisionGrid">
            <OperationForm
              action={reviewAdvisoryRuleAction}
              decision="APPROVE"
              ruleId={rule.id}
              button="Approve"
              placeholder="Approval note (optional)"
              optional
            />
            <OperationForm
              action={reviewAdvisoryRuleAction}
              decision="REJECT"
              ruleId={rule.id}
              button="Reject"
              placeholder="Required rejection reason"
              danger
            />
          </div>
        </section>
      ) : null}
      {rule.status !== 'ARCHIVED' ? (
        <OperationForm
          action={archiveAdvisoryRuleAction}
          ruleId={rule.id}
          button="Archive advisory"
          placeholder="Reason for archiving"
          danger
        />
      ) : null}
      {editable ? (
        <>
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">Authoring</p>
              <h3>{rule.status === 'APPROVED' ? 'Create a new version' : 'Edit draft'}</h3>
            </div>
          </div>
          <AdvisoryForm
            action={updateAdvisoryRuleAction}
            rule={rule}
            submitLabel={rule.status === 'APPROVED' ? 'Save as new draft version' : 'Save changes'}
          />
        </>
      ) : null}
    </>
  );
}

function OperationForm({
  action,
  ruleId,
  button,
  placeholder,
  decision,
  danger = false,
  optional = false,
}: {
  action: (formData: FormData) => Promise<void>;
  ruleId: string;
  button: string;
  placeholder: string;
  decision?: string;
  danger?: boolean;
  optional?: boolean;
}) {
  return (
    <form action={action} className="panel rejectForm">
      <input name="ruleId" type="hidden" value={ruleId} />
      {decision ? <input name="decision" type="hidden" value={decision} /> : null}
      <input
        maxLength={500}
        minLength={3}
        name="reason"
        placeholder={placeholder}
        required={!optional}
      />
      <ConfirmSubmitButton
        className={danger ? 'dangerButton' : 'primaryButton'}
        confirmMessage={`${button}?`}
      >
        {button}
      </ConfirmSubmitButton>
    </form>
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
function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
function advisoryStatusTone(status: AdvisoryRule['status']): 'ok' | 'warn' | 'danger' {
  return status === 'APPROVED'
    ? 'ok'
    : status === 'REJECTED' || status === 'ARCHIVED'
      ? 'danger'
      : 'warn';
}
