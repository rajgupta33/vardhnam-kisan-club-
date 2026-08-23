import type {
  KisanClubPromoterProfile,
  PromoterTerritory,
  PromoterTerritoryOption,
  PromoterTerritoryStatus,
} from '@vardhnam/api-client';
import { BusinessShell } from '../../../components/business-shell';
import { ConfirmSubmitButton } from '../../../components/confirm-submit-button';
import { EmptyState } from '../../../components/empty-state';
import { Pagination } from '../../../components/pagination';
import { StatusBadge } from '../../../components/status-badge';
import { readPortalSession } from '../../../lib/auth-session';
import { labelFromCode } from '../../../lib/format';
import {
  loadKisanClubPromoterProfiles,
  loadPromoterTerritories,
  loadPromoterTerritoryOptions,
} from '../../../lib/marketplace-api';
import {
  createTerritoryAction,
  updateTerritoryAction,
  upsertPromoterProfileAction,
} from './actions';

export const dynamic = 'force-dynamic';
type SearchParams = Record<string, string | string[] | undefined>;
const territoryStatuses: PromoterTerritoryStatus[] = ['ACTIVE', 'INACTIVE'];
// Matches the other Kisan Club queues. Both lists on this page page
// independently, so each carries its own page parameter.
const listLimit = 25;

export default async function KisanClubNetworkPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const params = (await searchParams) ?? {};
  const session = await readPortalSession();
  const permissions = new Set(session?.permissions ?? []);
  const canManageTerritories = permissions.has('kisan-club-territories:manage');
  const canManageProfiles = permissions.has('kisan-club-promoter-profiles:manage');
  const territoryStatus = parseAllowed(readParam(params.territoryStatus), territoryStatuses);
  const territoryQuery = readParam(params.territoryQuery)?.trim() || undefined;
  const profileTerritoryId = readParam(params.profileTerritoryId)?.trim() || undefined;
  const clubEnabled = parseBoolean(readParam(params.clubEnabled));
  const territoryPage = positiveInteger(readParam(params.territoryPage), 1);
  const profilePage = positiveInteger(readParam(params.profilePage), 1);

  // Three requests, not two. The first two are the filtered, paged management
  // queues; the third is the complete territory list that the promoter filter
  // and form select from. They were once the same request, which meant
  // filtering the queue to ACTIVE also removed every inactive territory from
  // the promoter form, and any territory past the page size vanished from it
  // with no error shown.
  const [territoryResult, profileResult, territoryOptionsResult] = await Promise.all([
    canManageTerritories
      ? loadPromoterTerritories({
          ...(territoryStatus ? { status: territoryStatus } : {}),
          ...(territoryQuery ? { q: territoryQuery } : {}),
          page: territoryPage,
          limit: listLimit,
        })
      : Promise.resolve(null),
    canManageProfiles
      ? loadKisanClubPromoterProfiles({
          ...(profileTerritoryId ? { territoryId: profileTerritoryId } : {}),
          ...(clubEnabled !== undefined ? { clubEnabled } : {}),
          page: profilePage,
          limit: listLimit,
        })
      : Promise.resolve(null),
    canManageTerritories || canManageProfiles
      ? loadPromoterTerritoryOptions()
      : Promise.resolve(null),
  ]);
  const territories = territoryResult?.ok ? territoryResult.data.items : [];
  const profiles = profileResult?.ok ? profileResult.data.items : [];
  const territoryOptions = territoryOptionsResult?.ok ? territoryOptionsResult.data.items : [];

  return (
    <BusinessShell
      active="kisanNetwork"
      eyebrow="Kisan Club field network"
      statuses={[
        {
          label: territoryResult?.ok
            ? `${territoryResult.data.total} territories`
            : 'Territories restricted',
          tone: territoryResult?.ok ? 'ok' : 'warn',
        },
        {
          label: profileResult?.ok
            ? `${profileResult.data.total} promoter profiles`
            : 'Profiles restricted',
          tone: profileResult?.ok ? 'ok' : 'warn',
        },
      ]}
      title="Promoters and Territories"
    >
      {readParam(params.notice) ? (
        <p className="noticeBanner ok">{readParam(params.notice)}</p>
      ) : null}
      {readParam(params.error) ? (
        <p className="noticeBanner danger">{readParam(params.error)}</p>
      ) : null}

      {canManageTerritories ? (
        <TerritoryWorkspace
          buildPageHref={(target) => workspaceHref(params, { territoryPage: String(target) })}
          {...(territoryResult && !territoryResult.ok ? { error: territoryResult.error } : {})}
          page={territoryPage}
          {...(territoryQuery ? { query: territoryQuery } : {})}
          {...(territoryStatus ? { selectedStatus: territoryStatus } : {})}
          territories={territories}
          total={territoryResult?.ok ? territoryResult.data.total : 0}
        />
      ) : null}

      {canManageProfiles ? (
        <PromoterWorkspace
          buildPageHref={(target) => workspaceHref(params, { profilePage: String(target) })}
          {...(clubEnabled !== undefined ? { clubEnabled } : {})}
          {...(profileResult && !profileResult.ok ? { error: profileResult.error } : {})}
          page={profilePage}
          profiles={profiles}
          {...(profileTerritoryId ? { selectedTerritoryId: profileTerritoryId } : {})}
          territories={territoryOptions}
          total={profileResult?.ok ? profileResult.data.total : 0}
        />
      ) : null}
    </BusinessShell>
  );
}

function TerritoryWorkspace({
  territories,
  selectedStatus,
  query,
  error,
  page,
  total,
  buildPageHref,
}: {
  territories: PromoterTerritory[];
  selectedStatus?: PromoterTerritoryStatus;
  query?: string;
  error?: string;
  page: number;
  total: number;
  buildPageHref: (page: number) => string;
}) {
  return (
    <>
      <section className="panel">
        <div className="rowHeader">
          <div>
            <p className="eyebrow">Coverage administration</p>
            <h3>Territories</h3>
          </div>
        </div>
        <form className="filterForm" method="get">
          <label>
            Search
            <input
              defaultValue={query ?? ''}
              maxLength={120}
              name="territoryQuery"
              placeholder="Name, district or state"
            />
          </label>
          <label>
            Status
            <select defaultValue={selectedStatus ?? ''} name="territoryStatus">
              <option value="">All statuses</option>
              {territoryStatuses.map((status) => (
                <option key={status} value={status}>
                  {labelFromCode(status)}
                </option>
              ))}
            </select>
          </label>
          <button className="queueAction" type="submit">
            Filter territories
          </button>
        </form>
      </section>
      <TerritoryForm action={createTerritoryAction} title="Create territory" />
      {error ? (
        <EmptyState description={error} title="Unable to load territories" />
      ) : territories.length === 0 ? (
        <EmptyState
          description="Change the territory filters or create a new coverage area."
          title="No territories match"
        />
      ) : (
        <section className="queueList" aria-label="Promoter territories">
          {territories.map((territory) => (
            <TerritoryForm
              action={updateTerritoryAction}
              key={territory.id}
              territory={territory}
              title={territory.name}
            />
          ))}
        </section>
      )}
      {error ? null : (
        <Pagination buildHref={buildPageHref} limit={listLimit} page={page} total={total} />
      )}
    </>
  );
}

function TerritoryForm({
  action,
  title,
  territory,
}: {
  action: (formData: FormData) => Promise<void>;
  title: string;
  territory?: PromoterTerritory;
}) {
  return (
    <form action={action} className="panel rejectForm">
      <div className="rowHeader">
        <div>
          <p className="eyebrow">{territory ? 'Coverage area' : 'New coverage area'}</p>
          <h3>{title}</h3>
        </div>
        {territory ? (
          <StatusBadge
            label={labelFromCode(territory.status)}
            tone={territory.status === 'ACTIVE' ? 'ok' : 'warn'}
          />
        ) : null}
      </div>
      {territory ? <input name="territoryId" type="hidden" value={territory.id} /> : null}
      <label>
        Name
        <input
          defaultValue={territory?.name ?? ''}
          maxLength={120}
          minLength={2}
          name="name"
          required
        />
      </label>
      <label>
        State
        <input
          defaultValue={territory?.state ?? ''}
          maxLength={120}
          minLength={2}
          name="state"
          required
        />
      </label>
      <label>
        District
        <input
          defaultValue={territory?.district ?? ''}
          maxLength={120}
          minLength={2}
          name="district"
          required
        />
      </label>
      <label>
        Blocks, comma separated
        <input defaultValue={territory?.blocks.join(', ') ?? ''} name="blocks" />
      </label>
      <label>
        Pincodes, comma separated
        <input
          defaultValue={territory?.pincodes.join(', ') ?? ''}
          name="pincodes"
          placeholder="207001, 207002"
        />
      </label>
      <label>
        Villages, comma separated
        <input defaultValue={territory?.villages.join(', ') ?? ''} name="villages" />
      </label>
      <label>
        Status
        <select defaultValue={territory?.status ?? 'ACTIVE'} name="status">
          {territoryStatuses.map((status) => (
            <option key={status} value={status}>
              {labelFromCode(status)}
            </option>
          ))}
        </select>
      </label>
      {territory?.status === 'ACTIVE' ? (
        <p className="mutedText">
          The backend rejects inactivation while this territory has active farmer assignments.
        </p>
      ) : null}
      <ConfirmSubmitButton
        confirmMessage={
          territory
            ? 'Save these territory coverage and status changes?'
            : 'Create this promoter territory?'
        }
      >
        {territory ? 'Save territory' : 'Create territory'}
      </ConfirmSubmitButton>
    </form>
  );
}

function PromoterWorkspace({
  profiles,
  territories,
  selectedTerritoryId,
  clubEnabled,
  error,
  page,
  total,
  buildPageHref,
}: {
  profiles: KisanClubPromoterProfile[];
  /** The complete territory list, never the paged management queue. */
  territories: PromoterTerritoryOption[];
  selectedTerritoryId?: string;
  clubEnabled?: boolean;
  error?: string;
  page: number;
  total: number;
  buildPageHref: (page: number) => string;
}) {
  return (
    <>
      <section className="panel">
        <div className="rowHeader">
          <div>
            <p className="eyebrow">Eligibility and capacity</p>
            <h3>Club promoter profiles</h3>
          </div>
        </div>
        <form className="filterForm" method="get">
          <label>
            Territory
            <select defaultValue={selectedTerritoryId ?? ''} name="profileTerritoryId">
              <option value="">All territories</option>
              {territories.map((territory) => (
                <option key={territory.id} value={territory.id}>
                  {territory.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Club status
            <select
              defaultValue={clubEnabled === undefined ? '' : String(clubEnabled)}
              name="clubEnabled"
            >
              <option value="">All profiles</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </label>
          <button className="queueAction" type="submit">
            Filter promoters
          </button>
        </form>
      </section>
      <PromoterForm territories={territories} title="Add Club promoter profile" />
      {error ? (
        <EmptyState description={error} title="Unable to load promoter profiles" />
      ) : profiles.length === 0 ? (
        <EmptyState
          description="Change the promoter filters or add a Club promoter profile."
          title="No promoter profiles match"
        />
      ) : (
        <section className="queueList" aria-label="Club promoter profiles">
          {profiles.map((profile) => (
            <PromoterForm
              key={profile.id}
              profile={profile}
              territories={territories}
              title={
                profile.promoterUser.profile?.displayName ||
                profile.promoterUser.phone ||
                profile.promoterUser.email ||
                profile.promoterUserId
              }
            />
          ))}
        </section>
      )}
      {error ? null : (
        <Pagination buildHref={buildPageHref} limit={listLimit} page={page} total={total} />
      )}
    </>
  );
}

function PromoterForm({
  title,
  territories,
  profile,
}: {
  title: string;
  territories: PromoterTerritoryOption[];
  profile?: KisanClubPromoterProfile;
}) {
  return (
    <form action={upsertPromoterProfileAction} className="panel rejectForm">
      <div className="rowHeader">
        <div>
          <p className="eyebrow">
            {profile
              ? profile.promoterOrganisation.displayName
              : 'Eligibility is validated by the API'}
          </p>
          <h3>{title}</h3>
        </div>
        {profile ? (
          <StatusBadge
            label={profile.clubEnabled ? 'Club enabled' : 'Disabled'}
            tone={profile.clubEnabled ? 'ok' : 'warn'}
          />
        ) : null}
      </div>
      <label>
        Promoter user UUID
        <input
          defaultValue={profile?.promoterUserId ?? ''}
          name="promoterUserId"
          readOnly={Boolean(profile)}
          required
        />
      </label>
      <label>
        Promoter organisation UUID
        <input
          defaultValue={profile?.promoterOrganisationId ?? ''}
          name="promoterOrganisationId"
          readOnly={Boolean(profile)}
          required
        />
      </label>
      <label>
        Territory
        <select defaultValue={profile?.territoryId ?? ''} name="territoryId">
          <option value="">Select territory</option>
          {territories.map((territory) => (
            <option key={territory.id} value={territory.id}>
              {territory.name} — {territory.district}
            </option>
          ))}
        </select>
      </label>
      <label>
        Home village
        <input defaultValue={profile?.homeVillage ?? ''} maxLength={120} name="homeVillage" />
      </label>
      <label>
        Home pincode
        <input
          defaultValue={profile?.homePincode ?? ''}
          inputMode="numeric"
          name="homePincode"
          pattern="[0-9]{6}"
        />
      </label>
      <label>
        Maximum active farmers
        <input
          defaultValue={profile?.maxActiveFarmers ?? 150}
          max={10000}
          min={1}
          name="maxActiveFarmers"
          required
          step={1}
          type="number"
        />
      </label>
      {profile ? (
        <p className="mutedText">
          Current assignments: {profile.activeFarmerCount} of {profile.maxActiveFarmers}
        </p>
      ) : null}
      <label>
        <input defaultChecked={profile?.clubEnabled ?? false} name="clubEnabled" type="checkbox" />{' '}
        Club enabled
      </label>
      <label>
        <input
          defaultChecked={profile?.acceptingNewFarmers ?? true}
          name="acceptingNewFarmers"
          type="checkbox"
        />{' '}
        Accepting new farmers
      </label>
      <p className="mutedText">
        Enabling remains subject to active membership, organisation, territory, approved KYC and
        configured payout requirements.
      </p>
      <ConfirmSubmitButton
        confirmMessage={
          profile
            ? 'Save this promoter profile’s territory, capacity, and Club eligibility settings?'
            : 'Create this Club promoter profile?'
        }
      >
        Save promoter profile
      </ConfirmSubmitButton>
    </form>
  );
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 * Rebuilds this page URL with one page parameter changed.
 *
 * Both filter sets and both page numbers survive, so paging the territory
 * list does not reset where the promoter list was, or vice versa.
 */
function workspaceHref(params: SearchParams, overrides: Record<string, string>): string {
  const query = new URLSearchParams();
  for (const key of [
    'territoryStatus',
    'territoryQuery',
    'profileTerritoryId',
    'clubEnabled',
    'territoryPage',
    'profilePage',
  ]) {
    const value = readParam(params[key]);
    if (value) query.set(key, value);
  }
  for (const [key, value] of Object.entries(overrides)) query.set(key, value);
  return `/kisan-club/network?${query.toString()}`;
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseBoolean(value: string | undefined): boolean | undefined {
  return value === 'true' ? true : value === 'false' ? false : undefined;
}

function parseAllowed<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined {
  return value && allowed.includes(value as T) ? (value as T) : undefined;
}
