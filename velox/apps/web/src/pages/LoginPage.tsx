import { getLoginUrl } from '@/lib/auth';
import { useAuthStore } from '@/stores/auth-store';

export function LoginPage() {
  const isLoading = useAuthStore((s) => s.isLoading);

  // In dev mode, allow bypass
  const handleDevLogin = () => {
    useAuthStore.getState().setTokens(
      'dev-token',
      // Minimal JWT-like structure for dev
      `eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.${btoa(
        JSON.stringify({
          sub: 'dev-user',
          email: 'dev@velox.local',
          name: 'Dev User',
          'cognito:groups': ['admin'],
        })
      )}.dev`
    );
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-velox-bg flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-mono text-3xl font-medium tracking-wider text-velox-accent">
            VELOX
          </h1>
          <p className="text-sm text-velox-text-secondary mt-2">
            Video Content Management System
          </p>
        </div>

        <div className="bg-velox-surface rounded-xl border border-velox-border p-6 space-y-4">
          <a
            href={getLoginUrl()}
            className="block w-full px-4 py-3 bg-velox-accent text-velox-bg text-sm font-medium rounded-lg hover:bg-velox-accent-hover transition-colors text-center"
          >
            {isLoading ? 'Loading...' : 'Sign in with SSO'}
          </a>

          {import.meta.env.DEV && (
            <button
              onClick={handleDevLogin}
              className="w-full px-4 py-3 bg-velox-surface-hover text-velox-text-secondary text-sm font-medium rounded-lg border border-velox-border hover:border-velox-border-light transition-colors"
            >
              Dev Login (bypass)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
