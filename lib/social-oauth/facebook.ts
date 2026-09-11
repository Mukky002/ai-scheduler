import { ChannelTypeEnum } from '@/constants/channels';
import { OAuthProvider, OAuthTokenResponse, OAuthConnectionProfile } from './types';

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`${key} is missing.`);
  return value;
}

export function createFacebookProvider(): OAuthProvider {
  return {
    type: ChannelTypeEnum.FACEBOOK,

    getAuthorizationUrl: ({ state, redirectUri }) => {
      const authUrl =
        process.env.FACEBOOK_AUTH_URL ||
        'https://www.facebook.com/v22.0/dialog/oauth';
      const clientId = getEnv('FACEBOOK_CLIENT_ID');
      const scopes = getEnv('FACEBOOK_SCOPES')
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
          'public_profile,pages_show_list,pages_manage_posts,pages_read_engagement',
        state,
      });

      return `${authUrl}?${params.toString()}`;
    },

    exchangeCodeForToken: async ({ code, redirectUri }): Promise<OAuthTokenResponse> => {
      const tokenUrl =
        process.env.FACEBOOK_TOKEN_URL ||
        'https://graph.facebook.com/v22.0/oauth/access_token';
      const clientId = getEnv('FACEBOOK_CLIENT_ID');
      const clientSecret = getEnv('FACEBOOK_CLIENT_SECRET');

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
            `Facebook token exchange failed: ${shortRes.statusText}`
        );
      }

      const shortLivedToken = shortData.access_token;

      // 2. Exchange short-lived user token for long-lived user token (valid 60 days)
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

      // 3. Fetch user's managed Facebook Pages to get the Page Access Token
      const accountsUrl = new URL('https://graph.facebook.com/v22.0/me/accounts');
      accountsUrl.searchParams.set(
        'fields',
        'id,name,access_token,category,picture{url}'
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
            'Failed to fetch Facebook Pages for this account.'
        );
      }

      const pages = accountsData.data || [];
      if (pages.length === 0) {
        throw new Error(
          'No Facebook Page found. Meta APIs require posting to a Facebook Page. Please create or link a Page on facebook.com first.'
        );
      }

      // Use the primary managed page
      const primaryPage = pages[0];

      return {
        accessToken: primaryPage.access_token,
        refreshToken: userAccessToken,
        expiresAt: null, // Page access tokens derived from long-lived user tokens do not expire
      };
    },

    refreshToken: async ({ refreshToken }): Promise<OAuthTokenResponse> => {
      // Re-fetch the page token using the long-lived user token
      const accountsUrl = new URL('https://graph.facebook.com/v22.0/me/accounts');
      accountsUrl.searchParams.set('fields', 'id,name,access_token');
      accountsUrl.searchParams.set('access_token', refreshToken);

      const accountsRes = await fetch(accountsUrl.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      const accountsData = await accountsRes.json();
      const pages = accountsData.data || [];
      if (!accountsRes.ok || pages.length === 0) {
        throw new Error('Failed to refresh Facebook Page access token');
      }

      return {
        accessToken: pages[0].access_token,
        refreshToken,
        expiresAt: null,
      };
    },

    getProfile: async ({ accessToken }): Promise<OAuthConnectionProfile> => {
      // Calling /me with a Page Access Token returns the Page profile
      const profileUrl = new URL('https://graph.facebook.com/v22.0/me');
      profileUrl.searchParams.set('fields', 'id,name,picture{url}');

      const res = await fetch(profileUrl.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch Facebook Page details: ${res.statusText}`);
      }

      const page = await res.json();
      return {
        providerAccountId: page.id ?? null,
        handle: page.name ?? null,
        profileImage: page.picture?.data?.url ?? null,
      };
    },
  };
}
