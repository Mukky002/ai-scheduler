import { ChannelTypeEnum } from '@/constants/channels';
import { OAuthProvider, OAuthTokenResponse, OAuthConnectionProfile } from './types';

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is missing.`);
  return value;
}

export function createThreadsProvider(): OAuthProvider {
  return {
    type: ChannelTypeEnum.THREADS,

    getAuthorizationUrl: ({ state, redirectUri }) => {
      const authUrl = getEnv('THREADS_AUTH_URL');
      const clientId = getEnv('THREADS_CLIENT_ID');
      const scopes = getEnv('THREADS_SCOPES')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .join(',');

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes || 'threads_basic,threads_content_publish',
        state,
      });

      return `${authUrl}?${params.toString()}`;
    },

    exchangeCodeForToken: async ({ code, redirectUri }): Promise<OAuthTokenResponse> => {
      const tokenUrl = getEnv('THREADS_TOKEN_URL');
      const clientId = getEnv('THREADS_CLIENT_ID');
      const clientSecret = getEnv('THREADS_CLIENT_SECRET');

      // 1. Exchange auth code for short-lived access token (valid 1 hour)
      const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      });

      const shortRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body,
      });

      const shortData = await shortRes.json();
      if (!shortRes.ok) {
        throw new Error(
          shortData?.error_message ||
            shortData?.error?.message ||
            `Threads token exchange failed: ${shortRes.statusText}`
        );
      }

      const shortLivedToken = shortData.access_token;

      // 2. Exchange short-lived token for long-lived access token (valid 60 days)
      const longUrl = new URL('https://graph.threads.net/access_token');
      longUrl.searchParams.set('grant_type', 'th_exchange_token');
      longUrl.searchParams.set('client_secret', clientSecret);
      longUrl.searchParams.set('access_token', shortLivedToken);

      const longRes = await fetch(longUrl.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const longData = await longRes.json();
      if (!longRes.ok) {
        // Fall back to short-lived token if long exchange fails
        const seconds = Number(shortData.expires_in) || 3600;
        return {
          accessToken: shortLivedToken,
          refreshToken: null,
          expiresAt: new Date(Date.now() + seconds * 1000).toISOString(),
        };
      }

      const seconds = Number(longData.expires_in) || 5184000; // ~60 days
      return {
        accessToken: longData.access_token,
        refreshToken: longData.access_token, // Threads uses the long-lived token itself to refresh
        expiresAt: new Date(Date.now() + seconds * 1000).toISOString(),
      };
    },

    refreshToken: async ({ refreshToken }): Promise<OAuthTokenResponse> => {
      const refreshUrl = new URL('https://graph.threads.net/refresh_access_token');
      refreshUrl.searchParams.set('grant_type', 'th_refresh_token');
      refreshUrl.searchParams.set('access_token', refreshToken);

      const res = await fetch(refreshUrl.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data?.error?.message ||
            data?.error_message ||
            `Failed to refresh Threads token: ${res.statusText}`
        );
      }

      const seconds = Number(data.expires_in) || 5184000;
      return {
        accessToken: data.access_token,
        refreshToken: data.access_token,
        expiresAt: new Date(Date.now() + seconds * 1000).toISOString(),
      };
    },

    getProfile: async ({ accessToken }): Promise<OAuthConnectionProfile> => {
      const profileUrl =
        process.env.THREADS_PROFILE_URL ||
        'https://graph.threads.net/me?fields=id,username,name,threads_profile_picture_url';

      const res = await fetch(profileUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch Threads profile: ${res.statusText}`);
      }

      const data = await res.json();
      const profileData = data?.data ?? data;

      return {
        providerAccountId: profileData?.id ?? null,
        handle: profileData?.username ?? profileData?.name ?? null,
        profileImage: profileData?.threads_profile_picture_url ?? null,
      };
    },
  };
}
