// src/launcher/token-issuer.token.ts
export const LAUNCHER_TOKEN_ISSUER = Symbol('LAUNCHER_TOKEN_ISSUER');

export interface LauncherTokenIssuer {
  issueForDevice(input: {
    userId: string;
    roles: string[];
    scope?: string[];
  }): Promise<{
    accessToken: string;
    accessTokenExpiresIn: number;
    refreshToken: string;
  }>;
}
