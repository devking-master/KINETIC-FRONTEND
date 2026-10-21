import { AuthUser } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const TOKEN_KEY = 'kinetic_jwt_token';

// Proactively refresh the access token before a request if it expires within 5 minutes
const isTokenExpiringSoon = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const expiresAt = payload.exp * 1000;
    return Date.now() > expiresAt - 5 * 60 * 1000;
  } catch {
    return true;
  }
};

let refreshPromise: Promise<string | null> | null = null;

const doRefresh = async (): Promise<string | null> => {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // send httpOnly cookie
      headers: { 'X-Kinetic-Client': 'web' },
    });
    if (res.ok) {
      const body = await res.json();
      authApi.setToken(body.token);
      return body.token;
    }
    // Refresh failed → clear local token
    authApi.removeToken();
    return null;
  } catch {
    return null;
  }
};

export const authApi = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  removeToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  /** Get a valid access token, auto-refreshing if it's about to expire. */
  async getValidToken(): Promise<string | null> {
    const token = this.getToken();
    if (!token) return null;
    if (!isTokenExpiringSoon(token)) return token;

    // De-duplicate concurrent refresh calls
    if (!refreshPromise) {
      refreshPromise = doRefresh().finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  },

  async signup(data: { name: string; username: string; email: string; password: string }): Promise<{ token: string; user: AuthUser }> {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Signup failed');
    }

    this.setToken(body.token);
    return body;
  },

  async login(loginIdentifier: string, password: string): Promise<{ token: string; user: AuthUser }> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ loginIdentifier, password }),
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(body.message || 'Login failed');
    }

    this.setToken(body.token);
    return body;
  },

  async logout(): Promise<void> {
    const token = this.getToken();
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'X-Kinetic-Client': 'web', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
    } catch {
      // Best-effort
    } finally {
      this.removeToken();
    }
  },

  async getCurrentUser(): Promise<AuthUser | null> {
    const token = await this.getValidToken();
    if (!token) return null;

    try {
      const res = await fetch(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      });
      if (res.ok) {
        const body = await res.json();
        return body.user;
      }
      if (res.status === 401) {
        this.removeToken();
      }
    } catch {
      // Offline fallback token check
    }
    return null;
  },

  async getPublicProfile(username: string) {
    const token = this.getToken();
    const res = await fetch(`${API_BASE}/users/${encodeURIComponent(username)}`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || 'Unable to load profile');
    return body;
  },

  async updateProfile(data: { name?: string; bio?: string; avatarUrl?: string; coverUrl?: string; interests?: string[]; onboardingIntent?: 'explore' | 'create' | 'both'; onboardingCompleted?: boolean }) {
    const token = await this.getValidToken();
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || 'Unable to update profile');
    return body.user as AuthUser;
  },

  async toggleFollow(userId: string) {
    const token = await this.getValidToken();
    if (!token) throw new Error('Sign in to follow creators.');
    const res = await fetch(`${API_BASE}/users/${userId}/follow`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || 'Unable to update follow');
    return body as { following: boolean };
  },

  /** Submit a content report */
  async reportContent(data: {
    targetType: 'video' | 'track' | 'comment';
    targetId: string;
    reason: string;
    details?: string;
  }): Promise<{ message: string }> {
    const token = await this.getValidToken();
    const res = await fetch(`${API_BASE}/report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.message || 'Report failed');
    return body;
  },
};
