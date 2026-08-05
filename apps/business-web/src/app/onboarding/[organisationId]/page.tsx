import Link from 'next/link';
import type {
  CompanyProfile,
  DistributorProfile,
  KycDocument,
  OnboardingOrganisation,
} from '@vardhnam/api-client';
import { BusinessShell } from '../../../components/business-shell';
import { formatDateTime, labelFromCode } from '../../../lib/format';
import { loadAuditLogs, loadOnboardingOrganisation } from '../../../lib/marketplace-api';
import { reviewKycDocumentAction, reviewOrganisationAction } from './actions';

export const dynamic = 'force-dynamic';

type SearchParams = Record<string, string | string[] | undefined>;

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
  const organisationResult = await loadOnboardingOrganisation(organisationId);
  const auditResult = await loadAuditLogs({ organisationId, page: 1, limit: 10 });
  const notice = readParam(resolvedSearchParams.notice);
  const error = readParam(resolvedSearchParams.error);
  const statuses = [
    {
      label: organisationResult.config.configured ? 'Mock auth configured' : 'Mock auth missing',
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
        <Link className="textLink" href="/">
          Back to queue
        </Link>
        <Link className="textLink" href={`/audit?organisationId=${organisationId}`}>
          View audit trail
        </Link>
      </div>

      {notice ? <p className="noticeBanner ok">{notice}</p> : null}
      {error ? <p className="noticeBanner danger">{error}</p> : null}

      {!organisationResult.ok ? (
        <section className="emptyState" aria-label="Onboarding detail status">
          <h3>Onboarding Detail Unavailable</h3>
          <p className="mutedText">{organisationResult.error}</p>
        </section>
      ) : (
        <DetailWorkspace organisation={organisationResult.data} />
      )}

      <section className="auditPreview" aria-label="Organisation audit history">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">Audit</p>
            <h3>Organisation History</h3>
          </div>
        </div>
        {!auditResult.ok ? (
          <p className="mutedText">{auditResult.error}</p>
        ) : (
          <div className="tableShell">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {auditResult.data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td>{formatDateTime(entry.createdAt)}</td>
                    <td>{labelFromCode(entry.action)}</td>
                    <td>{entry.resourceType}</td>
                    <td>{entry.reason ?? 'Not recorded'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <span className={`statusBadge ${organisation.status === 'ACTIVE' ? 'ok' : 'warn'}`}>
            {labelFromCode(organisation.status)}
          </span>
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
            <span className="statusBadge ok">Ready for approval</span>
          ) : (
            readiness.missingRequirements.map((requirement) => (
              <span className="statusBadge warn" key={requirement}>
                Missing {labelFromCode(requirement)}
              </span>
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
        <p className="mutedText">No KYC metadata has been submitted.</p>
      ) : (
        <div className="documentList">
          {documents.map((document) => (
            <article className="documentRow" key={document.id}>
              <div>
                <div className="rowHeader compact">
                  <h4>{labelFromCode(document.documentType)}</h4>
                  <span className={`statusBadge ${document.status === 'APPROVED' ? 'ok' : 'warn'}`}>
                    {labelFromCode(document.status)}
                  </span>
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
      <button className="queueAction" disabled={document.status === status} type="submit">
        {labelFromCode(status)}
      </button>
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
      <button className="dangerButton" disabled={document.status === 'REJECTED'} type="submit">
        Reject
      </button>
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
          <button
            className="primaryButton"
            disabled={!ready || organisation.status === 'ACTIVE'}
            type="submit"
          >
            Approve Organisation
          </button>
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
          <button
            className="dangerButton"
            disabled={organisation.status === 'REJECTED'}
            type="submit"
          >
            Reject Organisation
          </button>
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

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
