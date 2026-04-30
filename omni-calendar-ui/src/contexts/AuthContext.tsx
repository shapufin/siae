import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";
import type { User } from "../types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isReadOnly: boolean;
  canEdit: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isSuperuser: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      const refresh = localStorage.getItem("refresh_token");
      if (refresh) {
        try {
          const res = await axios.post("http://localhost:8000/api/auth/token/refresh/", {
            refresh,
          });
          const newAccess = res.data.access;
          localStorage.setItem("token", newAccess);
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          return api(originalRequest);
        } catch {
          localStorage.removeItem("token");
          localStorage.removeItem("refresh_token");
          window.location.reload();
        }
      }
    }
    return Promise.reject(error);
  }
);

export { api };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api
        .get("/users/me/")
        .then((res) => setUser(res.data))
        .catch(() => {
          localStorage.removeItem("token");
          setToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [token]);

  const login = async (username: string, password: string) => {
    try {
      const res = await api.post("/auth/token/", { username, password });
      const { access, refresh } = res.data;
      localStorage.setItem("token", access);
      if (refresh) localStorage.setItem("refresh_token", refresh);
      setToken(access);
      const userRes = await api.get("/users/me/");
      setUser(userRes.data);
    } catch (err) {
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("refresh_token");
    setToken(null);
    setUser(null);
  };

  const isReadOnly: boolean = user?.permissions?.is_read_only ?? true;
  const isAdmin: boolean = Boolean(user?.permissions?.is_admin);
  const isManager: boolean = Boolean(user?.permissions?.is_manager);
  const isSuperuser: boolean = Boolean(user?.is_superuser);
  const canEdit: boolean = isAdmin || isManager;

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, isReadOnly, canEdit, isAdmin, isManager, isSuperuser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
