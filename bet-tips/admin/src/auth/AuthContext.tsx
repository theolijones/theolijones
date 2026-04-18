import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, tokens } from "../api/client";

export interface Me {
  userId: string;
  role: "admin" | "user";
  email?: string;
  sportsbetUsername?: string;
}

interface AuthValue {
  me: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tokens.access) {
      setLoading(false);
      return;
    }
    api<Me>("/me")
      .then(setMe)
      .catch(() => tokens.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api<{ accessToken: string; refreshToken: string; user: Me }>(
      "/auth/login",
      { method: "POST", body: { email, password }, auth: false }
    );
    tokens.set(data.accessToken, data.refreshToken);
    if (data.user.role !== "admin") {
      tokens.clear();
      throw new Error("This account is not an admin");
    }
    setMe(data.user);
  };

  const logout = () => {
    tokens.clear();
    setMe(null);
  };

  const value = useMemo<AuthValue>(() => ({ me, loading, login, logout }), [me, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
};
