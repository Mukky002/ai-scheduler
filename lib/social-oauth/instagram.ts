import { ChannelTypeEnum } from '@/constants/channels';
import { OAuthProvider, OAuthTokenResponse, OAuthConnectionProfile } from './types';

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is missing.`);
  return value;
}

export function createInstagramProvider(): OAuthProvider {
  return {
    type: ChannelTypeEnum.INSTAGRAM,

    getAuthorizationUrl: ({ state, redirectUri }) => {
      const authUrl =
        process.env.INSTAGRAM_AUTH_URL ||
        'https://www.facebook.com/v22.0/dialog/oauth';
      const clientId = getEnv('INSTAGRAM_CLIENT_ID');
      const scopes = getEnv('INSTAGRAM_SCOPES')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .join(',');

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope:
          scopes ||
          'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement',
        state,
      });

      return `${authUrl}?${params.toString()}`;
    },

    exchangeCodeForToken: async ({ code, redirectUri }): Promise<OAuthTokenResponse> => {
      const tokenUrl =
        process.env.INSTAGRAM_TOKEN_URL ||
        'https://graph.facebook.com/v22.0/oauth/access_token';
      const clientId = getEnv('INSTAGRAM_CLIENT_ID');
      const clientSecret = getEnv('INSTAGRAM_CLIENT_SECRET');

      // 1. Exchange auth code for user access token
      const shortUrl = new URL(tokenUrl);
      shortUrl.searchParams.set('client_id', clientId);
      shortUrl.searchParams.set('client_secret', clientSecret);
      shortUrl.searchParams.set('redirect_uri', redirectUri);
      shortUrl.searchParams.set('code', code);

      const shortRes = await fetch(shortUrl.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const shortData = await shortRes.json();
      if (!shortRes.ok) {
        throw new Error(
          shortData?.error?.message ||
            `Instagram token exchange failed: ${shortRes.statusText}`
        );
      }

      const shortLivedToken = shortData.access_token;

      // 2. Exchange for long-lived user token (valid 60 days)
      const longUrl = new URL('https://graph.facebook.com/v22.0/oauth/access_token');
      longUrl.searchParams.set('grant_type', 'fb_exchange_token');
      longUrl.searchParams.set('client_id', clientId);
      longUrl.searchParams.set('client_secret', clientSecret);
      longUrl.searchParams.set('fb_exchange_token', shortLivedToken);

      const longRes = await fetch(longUrl.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const longData = await longRes.json();
      const userAccessToken = longData?.access_token || shortLivedToken;

      // 3. Query Facebook Pages to find linked Instagram Business Account
      const accountsUrl = new URL('https://graph.facebook.com/v22.0/me/accounts');
      accountsUrl.searchParams.set(
        'fields',
        'id,name,access_token,instagram_business_account{id,username,profile_picture_url}'
      );
      accountsUrl.searchParams.set('access_token', userAccessToken);

      const accountsRes = await fetch(accountsUrl.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const accountsData = await accountsRes.json();
      if (!accountsRes.ok) {
        throw new Error(
          accountsData?.error?.message ||
            'Failed to fetch accounts for Instagram connection.'
        );
      }

      const pages = accountsData.data || [];
      interface PageWithIg {
        id: string;
        name: string;
        access_token: string;
        instagram_business_account?: {
          id: string;
          username: string;
          profile_picture_url?: string;
        };
      }

      const pageWithIg = pages.find(
        (p: PageWithIg) => p.instagram_business_account?.id
      );

      if (!pageWithIg || !pageWithIg.instagram_business_account) {
        throw new Error(
          'No Instagram Professional (Business or Creator) account linked to your Facebook Page. Please ensure your Instagram account is set to Professional and connected to your Facebook Page.'
        );
      }

      return {
        accessToken: pageWithIg.access_token,
        refreshToken: userAccessToken,
        expiresAt: null,
      };
    },

    refreshToken: async ({ refreshToken }): Promise<OAuthTokenResponse> => {
      const accountsUrl = new URL('https://graph.facebook.com/v22.0/me/accounts');
      accountsUrl.searchParams.set(
        'fields',
        'id,name,access_token,instagram_business_account{id,username}'
      );
      accountsUrl.searchParams.set('access_token', refreshToken);

      const accountsRes = await fetch(accountsUrl.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const accountsData = await accountsRes.json();
      const pages = accountsData.data || [];
      const pageWithIg = pages.find(
        (p: { instagram_business_account?: { id: string } }) =>
          p.instagram_business_account?.id
      );

      if (!accountsRes.ok || !pageWithIg) {
        throw new Error('Failed to refresh Instagram access token');
      }

      return {
        accessToken: pageWithIg.access_token,
        refreshToken,
        expiresAt: null,
      };
    },

    getProfile: async ({ accessToken }): Promise<OAuthConnectionProfile> => {
      const pageUrl = new URL('https://graph.facebook.com/v22.0/me');
      pageUrl.searchParams.set(
        'fields',
        'id,name,instagram_business_account{id,username,profile_picture_url}'
      );

      const res = await fetch(pageUrl.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch Instagram profile: ${res.statusText}`);
      }

      const data = await res.json();
      const ig = data.instagram_business_account;

      return {
        providerAccountId: ig?.id ?? null,
        handle: ig?.username ?? null,
        profileImage: ig?.profile_picture_url ?? null,
      };
    },
  };
}
