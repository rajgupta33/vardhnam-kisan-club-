import { redirect } from 'next/navigation';
import { readPortalSelection } from '../../../lib/auth-session';
import { selectOrganisationAction } from '../actions';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function SelectOrganisationPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const selection = await readPortalSelection();
  if (!selection) {
    redirect('/login?error=Your%20organisation%20selection%20expired.');
  }
  const resolvedSearchParams = (await searchParams) ?? {};
  const error = readParam(resolvedSearchParams.error);

  return (
    <main className="loginPage">
      <div className="loginContainer">
        <section className="loginBrand">
          <div className="loginBrandInner">
            <span className="loginLogo">VA</span>
            <h1 className="loginBrandTitle">Choose your workspace</h1>
            <p className="loginBrandSubtitle">
              Your permissions and accessible records follow the selected organisation membership.
            </p>
          </div>
        </section>
        <section className="loginFormPanel">
          <div className="loginFormInner">
            <div className="loginFormHeader">
              <h2>Select organisation</h2>
              <p className="loginFormSubheading">
                Choose the organisation and role to use for this session.
              </p>
            </div>
            <form action={selectOrganisationAction} className="loginForm">
              {error ? (
                <div className="loginError" role="alert">
                  {error}
                </div>
              ) : null}
              <div className="orgCandidateList">
                {selection.candidates.map((candidate, index) => (
                  <label
                    className="orgCandidate"
                    key={`${candidate.organisationId}:${candidate.role}`}
                  >
                    <input
                      defaultChecked={index === 0}
                      name="organisationId"
                      required
                      type="radio"
                      value={candidate.organisationId}
                    />
                    <span>
                      <span className="orgCandidateName">{candidate.organisationName}</span>
                      <span className="orgCandidateRole">{labelFromCode(candidate.role)}</span>
                    </span>
                  </label>
                ))}
              </div>
              <button className="loginButton" type="submit">
                Continue
              </button>
              <a className="loginBackButton" href="/login">
                Back to sign in
              </a>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

function labelFromCode(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
