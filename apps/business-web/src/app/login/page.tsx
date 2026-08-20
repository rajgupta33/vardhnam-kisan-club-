import { loginAction } from './actions';

type SearchParams = Record<string, string | string[] | undefined>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const error = readParam(resolvedSearchParams.error);

  return (
    <main className="loginPage">
      <div className="loginContainer">
        <section className="loginBrand">
          <div className="loginBrandInner">
            <span className="loginLogo">VA</span>
            <h1 className="loginBrandTitle">Vardhnam Agrotech</h1>
            <p className="loginBrandSubtitle">
              Managed agriculture marketplace operations for authorised business users.
            </p>
            <div className="loginBrandFeatures">
              <p className="loginFeature">Catalogue and inventory management</p>
              <p className="loginFeature">Order fulfilment and delivery</p>
              <p className="loginFeature">Commission and settlement tracking</p>
              <p className="loginFeature">Support and operational reporting</p>
            </div>
          </div>
        </section>

        <section className="loginFormPanel">
          <div className="loginFormInner">
            <div className="loginFormHeader">
              <h2>Sign in to Business Portal</h2>
              <p className="loginFormSubheading">
                Enter your email address or phone number and password.
              </p>
            </div>
            <form action={loginAction} className="loginForm">
              {error ? (
                <div className="loginError" role="alert">
                  {error}
                </div>
              ) : null}
              <label className="loginLabel" htmlFor="login-identifier">
                Phone or email
                <input
                  autoComplete="username"
                  autoFocus
                  id="login-identifier"
                  name="identifier"
                  required
                  type="text"
                />
              </label>
              <label className="loginLabel" htmlFor="login-password">
                Password
                <input
                  autoComplete="current-password"
                  id="login-password"
                  minLength={8}
                  name="password"
                  required
                  type="password"
                />
              </label>
              <button className="loginButton" type="submit">
                Sign in
              </button>
            </form>
            <p className="loginFootnote">
              Farmers and field partners should use their dedicated mobile application.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function readParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
