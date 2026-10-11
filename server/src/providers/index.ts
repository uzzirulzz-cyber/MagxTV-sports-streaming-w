import { config } from '../config';
import type { ProviderStatus } from '../types';
import { buildCatalog } from './catalog';
import type { Catalog } from './catalog';
import { xtreamProvider } from './xtream';

export interface ProviderResult { catalog: Catalog; status: ProviderStatus }

/* ---------------------------------------------------------------------------
   Sports data provider adapter.
     mock   -> bundled demo catalogue; every payload carries demo:true so the UI
               can render the "DEMO DATA" badge.
     xtream -> an Xtream-Codes-compatible panel that the OPERATOR owns and is
               licensed for. Credentials stay server-side and never reach the
               browser bundle.
   Add another integration by implementing the same shape and registering it
   in the switch below.
   --------------------------------------------------------------------------- */
export async function loadCatalog(): Promise<ProviderResult> {
  if (config.provider === 'xtream' && config.providerBaseUrl && config.providerUser && config.providerPass) {
    try {
      return await xtreamProvider();
    } catch (e) {
      return {
        catalog: buildCatalog(Date.now()),
        status: {
          provider: 'xtream', demo: true, baseUrl: config.providerBaseUrl,
          message: `The configured provider could not be reached (${e instanceof Error ? e.message : 'unknown error'}). Serving the labelled demo catalogue instead.`
        }
      };
    }
  }
  return {
    catalog: buildCatalog(Date.now()),
    status: {
      provider: 'mock', demo: true, baseUrl: config.providerBaseUrl,
      message: config.providerBaseUrl
        ? 'SPORTS_PROVIDER is not pointing at a configured integration — serving the bundled demo catalogue (demo:true).'
        : 'No sports data provider configured. Set SPORTS_PROVIDER plus SPORTS_API_BASE_URL / SPORTS_API_USER / SPORTS_API_PASS to stream real fixtures. All demo payloads are flagged demo:true.'
    }
  };
}
