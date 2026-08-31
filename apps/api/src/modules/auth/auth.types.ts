export interface AuthenticatedUser {
  id: string;
  githubId: number;
  githubLogin: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface GithubOAuthTokenResponse {
  access_token: string;
  scope: string;
  token_type: string;
}

export interface GithubAuthenticatedUserResponse {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
}
