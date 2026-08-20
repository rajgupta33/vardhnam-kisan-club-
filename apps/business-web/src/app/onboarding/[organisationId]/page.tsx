import Link from 'next/link';
import type {
  AuditLog,
  CompanyProfile,
  DistributorProfile,
  KycDocument,
  OnboardingOrganisation,
} from '@vardhnam/api-client';
import { BusinessShell } from '../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../components/confirm-submit-button';
import { DataTable, type DataTableColumn } from '../../../components/data-table';
import { EmptyState } from '../../../components/empty-state';
import { Pagination } from '../../../components/pagination';
import { StatusBadge } from '../../../components/status-badge';
import { formatDateTime, labelFromCode } from '../../../lib/format';
import { loadAuditLogs, loadOnboardingOrganisation } from '../../../lib/marketplace-api';
import { reviewKycDocumentAction, reviewOrganisationAction } from './actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;
const auditLimit = 10;

interface OnboardingDetailPageProps {
  params: Promise<{ organisationId: string }>;
  searchParams?: Promise<SearchParams>;
}

export default async function OnboardingDetailPage({
  params,
  searchParams,
}: OnboardingDetailPageProps) {
  const { organisationId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const auditPage = parsePage(readParam(resolvedSearchParams.auditPage));
  const organisationResult = await loadOnboardingOrganisation(organisationId);
  const auditResult = await loadAuditLogs({ organisationId, page: auditPage, limit: auditLimit });
  const notice = readParam(resolvedSearchParams.notice);
  const error = readParam(resolvedSearchParams.error);
  const auditEntries = auditResult.ok ? auditResult.data.items : [];
  const auditTotal = auditResult.ok ? auditResult.data.total : 0;
  const auditColumns: DataTableColumn<AuditLog>[] = [
    { key: 'time', header: 'Time', render: (entry) => formatDateTime(entry.createdAt) },
    { key: 'action', header: 'Action', render: (entry) => labelFromCode(entry.action) },
    { key: 'resource', header: 'Resource', render: (entry) => entry.resourceType },
    { key: 'reason', header: 'Reason', render: (entry) => entry.reason ?? 'Not recorded' },
  ];
  const statuses = [
    {
      label: organisationResult.config.configured ? 'Authenticated session' : 'Session missing',
      tone: organisationResult.config.configured ? ('ok' as const) : ('danger' as const),
    },
    {
      label: organisationResult.ok ? 'Detail loaded' : 'API not connected',
      tone: organisationResult.ok ? ('ok' as const) : ('warn' as const),
    },
    { label: 'Metadata-only KYC', tone: 'warn' as const },
  ];

  return (
    <BusinessShell
      active="onboarding"
      eyebrow="Onboarding detail"
      statuses={statuses}
      title={organisationResult.ok ? organisationResult.data.displayName : 'Onboarding Record'}
    >
      <div className="breadcrumbRow">
        <Link className="textLink" href="/onboarding">
          Back to queue
        </Link>
        <Link className="textLink" href={`/audit?organisationId=${organisationId}`}>
          View audit trail
        </Link>
      </div>

      {notice ? <p className="noticeBanner ok">{notice}</p> : null}
      {error ? <p className="noticeBanner danger">{error}</p> : null}

      {!organisationResult.ok ? (
        <EmptyState description={organisationResult.error} title="Onboarding Detail Unavailable" />
      ) : (
        <DetailWorkspace organisation={organisationResult.data} />
      )}

      <section
        className="auditPreview"
        id="organisation-audit-history"
        aria-label="Organisation audit history"
      >
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Audit</p>
            <h3>Organisation History</h3>
          </div>
        </div>
        {!auditResult.ok ? (
          <EmptyState description={auditResult.error} title="Organisation history is unavailable" />
        ) : (
          <>
            <DataTable
              caption="Organisation audit history"
              columns={auditColumns}
              emptyDescription="Organisation review events will appear here."
              emptyTitle="No organisation history"
              rowKey={(entry) => entry.id}
              rows={auditEntries}
            />
            <Pagination
              buildHref={(targetPage) => buildOnboardingDetailHref(organisationId, targetPage)}
              limit={auditLimit}
              page={auditPage}
              total={auditTotal}
            />
          </>
        )}
      </section>
    </BusinessShell>
  );
}

function DetailWorkspace({ organisation }: { organisation: OnboardingOrganisation }) {
  const readiness = getReadiness(organisation);

  return (
    <div className="detailGrid">
      <section className="panel spanTwo">
        <div className="rowHeader">
          <div>
            <p className="eyebrow">{labelFromCode(organisation.type)}</p>
            <h3>{organisation.legalName}</h3>
          </div>
          <StatusBadge
            label={labelFromCode(organisation.status)}
            tone={organisationStatusTone(organisation.status)}
          />
        </div>
        <dl className="definitionGrid threeColumn">
          <div>
            <dt>Slug</dt>
            <dd>{organisation.slug}</dd>
          </div>
          <div>
            <dt>GSTIN</dt>
            <dd>{organisation.gstin ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{formatDateTime(organisation.createdAt)}</dd>
          </div>
          <div>
            <dt>Reviewed</dt>
            <dd>{formatDateTime(organisation.reviewedAt)}</dd>
          </div>
          <div>
            <dt>Reviewer</dt>
            <dd>{organisation.reviewedBy?.profile?.displayName ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Review reason</dt>
            <dd>{organisation.reviewReason ?? 'Not recorded'}</dd>
          </div>
        </dl>
      </section>

      <section className="panel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Readiness</p>
            <h3>Approval Checks</h3>
          </div>
        </div>
        <div className="requirementList stacked">
          {readiness.missingRequirements.length === 0 ? (
            <StatusBadge label="Ready for approval" tone="ok" />
          ) : (
            readiness.missingRequirements.map((requirement) => (
              <StatusBadge
                key={requirement}
                label={`Missing ${labelFromCode(requirement)}`}
                tone="warn"
              />
            ))
          )}
        </div>
      </section>

      <ProfilePanel organisation={organisation} />
      <KycPanel documents={organisation.kycDocuments} organisationId={organisation.id} />
      <OrganisationReviewPanel organisation={organisation} ready={readiness.ready} />
    </div>
  );
}

function ProfilePanel({ organisation }: { organisation: OnboardingOrganisation }) {
  const profile =
    organisation.type === 'COMPANY' ? organisation.companyProfile : organisation.distributorProfile;

  if (!profile) {
    return (
      <section className="panel">
        <p className="eyebrow">Profile</p>
        <h3>{labelFromCode(organisation.type)} Details</h3>
        <p className="mutedText">No profile has been submitted for this organisation.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <p className="eyebrow">Profile</p>
      <h3>{labelFromCode(organisation.type)} Details</h3>
      {organisation.type === 'COMPANY' ? (
        <CompanyProfileFields profile={profile as CompanyProfile} />
      ) : (
        <DistributorProfileFields profile={profile as DistributorProfile} />
      )}
    </section>
  );
}

function CompanyProfileFields({ profile }: { profile: CompanyProfile }) {
  return (
    <dl className="definitionGrid">
      <DetailField label="Brand name" value={profile.brandName} />
      <DetailField label="Registration" value={profile.registrationNumber} />
      <DetailField label="PAN" value={profile.pan} />
      <DetailField label="Contact" value={profile.primaryContactName} />
      <DetailField label="Phone" value={profile.primaryContactPhone} />
      <DetailField label="Email" value={profile.primaryContactEmail} />
      <DetailField label="Address" value={profile.registeredAddress} />
      <DetailField
        label="Location"
        value={[profile.city, profile.state, profile.pincode].filter(Boolean).join(', ')}
      />
    </dl>
  );
}

function DistributorProfileFields({ profile }: { profile: DistributorProfile }) {
  return (
    <dl className="definitionGrid">
      <DetailField label="Distributor code" value={profile.distributorCode} />
      <DetailField label="PAN" value={profile.pan} />
      <DetailField label="Contact" value={profile.primaryContactName} />
      <DetailField label="Phone" value={profile.primaryContactPhone} />
      <DetailField label="Email" value={profile.primaryContactEmail} />
      <DetailField label="Address" value={profile.operatingAddress} />
      <DetailField
        label="Location"
        value={[profile.city, profile.state, profile.pincode].filter(Boolean).join(', ')}
      />
      <DetailField label="Serviceable pincodes" value={profile.serviceablePincodes.join(', ')} />
      <DetailField label="Fulfilment" value={profile.fulfilmentCapability} />
    </dl>
  );
}

function KycPanel({
  documents,
  organisationId,
}: {
  documents: KycDocument[];
  organisationId: string;
}) {
  return (
    <section className="panel spanTwo">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">KYC</p>
          <h3>Document Metadata</h3>
        </div>
      </div>
      {documents.length === 0 ? (
        <EmptyState
          description="Submitted KYC document metadata will appear here."
          title="No KYC metadata submitted"
        />
      ) : (
        <div className="documentList">
          {documents.map((document) => (
            <article className="documentRow" key={document.id}>
              <div>
                <div className="rowHeader compact">
                  <h4>{labelFromCode(document.documentType)}</h4>
                  <StatusBadge
                    label={labelFromCode(document.status)}
                    tone={kycStatusTone(document.status)}
                  />
                </div>
                <dl className="definitionGrid threeColumn">
                  <DetailField label="Number" value={document.documentNumber} />
                  <DetailField label="File name" value={document.fileName} />
                  <DetailField label="Storage key" value={document.storageKey} />
                  <DetailField label="Issued" value={formatDateTime(document.issuedAt)} />
                  <DetailField label="Expires" value={formatDateTime(document.expiresAt)} />
                  <DetailField label="Rejection" value={document.rejectionReason} />
                </dl>
              </div>
              <div className="actionCluster">
                <KycActionForm
                  document={document}
                  organisationId={organisationId}
                  status="APPROVED"
                />
                <KycActionForm
                  document={document}
                  organisationId={organisationId}
                  status="EXPIRED"
                />
                <KycRejectForm document={document} organisationId={organisationId} />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function KycActionForm({
  document,
  organisationId,
  status,
}: {
  document: KycDocument;
  organisationId: string;
  status: 'APPROVED' | 'EXPIRED';
}) {
  return (
    <form action={reviewKycDocumentAction} className="inlineForm">
      <input name="organisationId" type="hidden" value={organisationId} />
      <input name="documentId" type="hidden" value={document.id} />
      <input name="status" type="hidden" value={status} />
      <input
        name="reason"
        type="hidden"
        value={`Marked ${status.toLowerCase()} from business portal`}
      />
      <ConfirmSubmitButton
        className="queueAction"
        confirmMessage={`Mark this KYC document as ${labelFromCode(status).toLowerCase()}?`}
        disabled={document.status === status}
      >
        {labelFromCode(status)}
      </ConfirmSubmitButton>
    </form>
  );
}

function KycRejectForm({
  document,
  organisationId,
}: {
  document: KycDocument;
  organisationId: string;
}) {
  return (
    <form action={reviewKycDocumentAction} className="rejectForm">
      <input name="organisationId" type="hidden" value={organisationId} />
      <input name="documentId" type="hidden" value={document.id} />
      <input name="status" type="hidden" value="REJECTED" />
      <input
        aria-label={`${labelFromCode(document.documentType)} rejection reason`}
        maxLength={500}
        name="rejectionReason"
        placeholder="Rejection reason"
        required
      />
      <ConfirmSubmitButton
        className="dangerButton"
        confirmMessage="Reject this KYC document with the recorded reason?"
        disabled={document.status === 'REJECTED'}
      >
        Reject
      </ConfirmSubmitButton>
    </form>
  );
}

function OrganisationReviewPanel({
  organisation,
  ready,
}: {
  organisation: OnboardingOrganisation;
  ready: boolean;
}) {
  return (
    <section className="panel spanTwo">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">Decision</p>
          <h3>Organisation Review</h3>
        </div>
      </div>
      <div className="decisionGrid">
        <form action={reviewOrganisationAction} className="decisionForm">
          <input name="organisationId" type="hidden" value={organisation.id} />
          <input name="decision" type="hidden" value="APPROVE" />
          <input
            name="reason"
            type="hidden"
            value="Onboarding profile and KYC metadata verified."
          />
          <ConfirmSubmitButton
            confirmMessage="Approve this organisation for marketplace access?"
            disabled={!ready || organisation.status === 'ACTIVE'}
          >
            Approve Organisation
          </ConfirmSubmitButton>
        </form>
        <form action={reviewOrganisationAction} className="decisionForm">
          <input name="organisationId" type="hidden" value={organisation.id} />
          <input name="decision" type="hidden" value="REJECT" />
          <input
            aria-label="Organisation rejection reason"
            maxLength={500}
            minLength={3}
            name="reason"
            placeholder="Rejection reason"
            required
          />
          <ConfirmSubmitButton
            className="dangerButton"
            confirmMessage="Reject this organisation with the recorded reason?"
            disabled={organisation.status === 'REJECTED'}
          >
            Reject Organisation
          </ConfirmSubmitButton>
        </form>
      </div>
    </section>
  );
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value && value.length > 0 ? value : 'Not recorded'}</dd>
    </div>
  );
}

function getReadiness(organisation: OnboardingOrganisation): {
  ready: boolean;
  missingRequirements: string[];
} {
  const hasProfile =
    organisation.type === 'COMPANY'
      ? organisation.companyProfile !== null
      : organisation.distributorProfile !== null;
  const hasApprovedKyc = organisation.kycDocuments.some(
    (document) => document.status === 'APPROVED',
  );
  const missingRequirements: string[] = [];

  if (!hasProfile) {
    missingRequirements.push('PROFILE');
  }
  if (!hasApprovedKyc) {
    missingRequirements.push('APPROVED_KYC_DOCUMENT');
  }

  return {
    ready: missingRequirements.length === 0,
    missingRequirements,
  };
}

function buildOnboardingDetailHref(organisationId: string, auditPage: number): string {
  const params = new URLSearchParams();
  if (auditPage > 1) params.set('auditPage', String(auditPage));
  const query = params.toString();
  return `/onboarding/${organisationId}${query ? `?${query}` : ''}#organisation-audit-history`;
}

function organisationStatusTone(
  status: OnboardingOrganisation['status'],
): 'ok' | 'warn' | 'danger' {
  if (status === 'ACTIVE') return 'ok';
  if (status === 'REJECTED' || status === 'SUSPENDED') return 'danger';
  return 'warn';
}

function kycStatusTone(status: KycDocument['status']): 'ok' | 'warn' | 'danger' {
  if (status === 'APPROVED') return 'ok';
  if (status === 'REJECTED' || status === 'EXPIRED') return 'danger';
  return 'warn';
}

function parsePage(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
