export type Role = 'user' | 'admin';
export type Plan = 'free' | 'standard' | 'premium';

export interface ApiUser {
  id: string; name: string; email: string; role: Role; plan: Plan; createdAt: string;
}

export interface ProviderStatus {
  provider: string; demo: boolean; baseUrl: string; message: string;
}
