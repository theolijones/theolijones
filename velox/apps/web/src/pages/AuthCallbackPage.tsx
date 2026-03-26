import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { exchangeCodeForTokens } from '@/lib/auth';
import { useAuthStore } from '@/stores/auth-store';

export function AuthCallbackPage() {
  const navigate = useNavigate();
  const setTokens = useAuthStore((s) => s.setTokens);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      navigate('/login');
      return;
    }

    exchangeCodeForTokens(code)
      .then(({ access_token, id_token }) => {
        setTokens(access_token, id_token);
        navigate('/');
      })
      .catch(() => {
        navigate('/login');
      });
  }, [navigate, setTokens]);

  return (
    <div className="min-h-screen bg-velox-bg flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-velox-accent border-t-transparent rounded-full mx-auto" />
        <p className="text-sm text-velox-text-secondary mt-4">Signing in...</p>
      </div>
    </div>
  );
}
