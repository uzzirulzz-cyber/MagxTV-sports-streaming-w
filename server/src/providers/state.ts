import type { ProviderStatus } from '../types';

/* Live snapshot of which integration is serving the catalogue — read by the
   admin dashboard and the DEMO DATA badge. */
export const PROVIDER_STATUS: ProviderStatus = {
  provider: 'mock', demo: true, baseUrl: '',
  message: 'No sports data provider configured — serving the labelled demo catalogue.'
};
