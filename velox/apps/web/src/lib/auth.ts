const COGNITO_DOMAIN = import.meta.env.VITE_COGNITO_DOMAIN || '';
const CLIENT_ID = import.meta.env.VITE_COGNITO_CLIENT_ID || '';
const REDIRECT_URI = import.meta.env.VITE_COGNITO_REDIRECT_URI || 'http://localhost:5173/auth/callback';

export function getLoginUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    scope: 'openid email profile',
    redirect_uri: REDIRECT_URI,
  });
  return `${COGNITO_DOMAIN}/login?${params.toString()}`;
}

export function getLogoutUrl(): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    logout_uri: window.location.origin,
  });
  return `${COGNITO_DOMAIN}/logout?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  id_token: string;
  refresh_token: string;
}> {
  const response = await fetch(`${COGNITO_DOMAIN}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      code,
    }),
  });

  if (!response.ok) {
    throw new Error('Token exchange failed');
  }

  return response.json();
}

export function parseJwt(token: string): Record<string, unknown> {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64)
      .split('')
      .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
      .join('')
  );
  return JSON.parse(jsonPayload);
}
