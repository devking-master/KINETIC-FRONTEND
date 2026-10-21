import { AuthUser } from '../types';
import { authApi } from './authApi';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export interface OnboardingOption {
  key: string;
  label: string;
  count: number;
}

export interface OnboardingOptions {
  genres: OnboardingOption[];
  topics: OnboardingOption[];
}

export interface SuggestedCreator {
  id: string;
  name: string;
  username: string;
  avatarUrl: string;
  followersCount: number;
  isFollowing: false;
}

export const onboardingApi = {
  async getOptions(): Promise<OnboardingOptions> {
    const response = await fetch(`${API_BASE}/onboarding/options`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Unable to load onboarding choices');
    return body;
  },

  async getSuggestedCreators(): Promise<SuggestedCreator[]> {
    const token = await authApi.getValidToken();
    if (!token) throw new Error('Sign in to see suggested creators');
    const response = await fetch(`${API_BASE}/onboarding/suggested-creators`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Unable to load creators');
    return body.creators || [];
  },

  async save(data: {
    genres: string[];
    topics: string[];
    role: 'listener' | 'creator';
    name?: string;
    bio?: string;
    avatarUrl?: string;
    completed: true;
  }): Promise<AuthUser> {
    const token = await authApi.getValidToken();
    if (!token) throw new Error('Your session expired. Sign in again to continue.');
    const response = await fetch(`${API_BASE}/onboarding`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Unable to save onboarding');
    return body.user as AuthUser;
  },
};
