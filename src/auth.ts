/** The small token surface the workbench needs from either local profile. */
export interface BrowserSession {
  logout(): Promise<void>;
  freshAccessToken(): Promise<string | undefined>;
  isAuthenticated(): boolean;
}

export interface LocalDevelopmentSessionResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  session: {
    subject: string;
    org_id: string;
    roles: string[];
  };
}

/**
 * An in-memory token holder for `local-development`.
 *
 * Backend issues this token only to loopback callers. It is never written to
 * browser storage, shared with another developer, or used by functional UAT.
 */
export class LocalDevelopmentSession implements BrowserSession {
  private accessToken: string | undefined;

  constructor(
    private readonly createSession: () => Promise<LocalDevelopmentSessionResponse>,
  ) {}

  async start(): Promise<void> {
    const response = await this.createSession();
    if (
      response.token_type !== "Bearer"
      || !isSafeLocalToken(response.access_token)
      || !Number.isInteger(response.expires_in)
      || response.expires_in < 1
      || response.expires_in > 8 * 60 * 60
      || !isSafeLocalIdentity(response.session)
    ) {
      throw new Error("Backend local-development session response is invalid");
    }
    this.accessToken = response.access_token;
  }

  async logout(): Promise<void> {
    this.accessToken = undefined;
    window.location.assign("/");
  }

  freshAccessToken = async (): Promise<string | undefined> => this.accessToken;

  isAuthenticated(): boolean {
    return this.accessToken !== undefined;
  }
}

function isSafeLocalToken(value: unknown): value is string {
  return typeof value === "string" && value.length >= 32 && value.length <= 2_048 && /^[A-Za-z0-9._~+/=-]+$/u.test(value);
}

function isSafeLocalIdentity(value: LocalDevelopmentSessionResponse["session"]): boolean {
  return typeof value.subject === "string" && value.subject.length > 0
    && typeof value.org_id === "string" && value.org_id.length > 0
    && Array.isArray(value.roles) && value.roles.length > 0
    && value.roles.every((role) => typeof role === "string" && role.length > 0);
}
