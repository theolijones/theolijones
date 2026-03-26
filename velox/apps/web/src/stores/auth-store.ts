import { create } from 'zustand';
import { parseJwt } from '@/lib/auth';

interface User {
  id: string;
  email: string;
  name: string;
  groups: string[];
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setTokens: (accessToken: string, idToken: string) => void;
  logout: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,

  setTokens: (accessToken: string, idToken: string) => {
    localStorage.setItem('velox_access_token', accessToken);
    localStorage.setItem('velox_id_token', idToken);

    const claims = parseJwt(idToken);
    const user: User = {
      id: (claims.sub as string) || '',
      email: (claims.email as string) || '',
      name: (claims.name as string) || (claims.email as string) || '',
      groups: (claims['cognito:groups'] as string[]) || [],
    };

    set({ user, accessToken, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('velox_access_token');
    localStorage.removeItem('velox_id_token');
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false });
  },

  setLoading: (loading: boolean) => set({ isLoading: loading }),
}));
