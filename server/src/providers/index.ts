import { config } from '../config';
import type { ProviderStatus } from '../types';
import { buildCatalog } from './catalog';
import type { Catalog } from './catalog';
import { xtreamProvider } from './xtream';
import { m3uProvider } from './m3u';

export interface ProviderResult { catalog: Catalog; status: ProviderStatus }

/* ---------------------------------------------------------------------------
   Sports data provider adapter.
     mock   -> bundled demo catalogue; every payload carries demo:true so the UI
               can render the "DEMO DATA" badge.
     m3u    -> an M3U playlist the operator imported through the worker queue.
               Used as the FALLBACK when the Xtream API is unset or unreachable.
     xtream -> an Xtream-Codes-compatible panel that the OPERATOR owns and is
               licensed for. Credentials stay server-side and never reach the
               browser bundle.
   Add another integration by implementing the same shape and registering it
   in the switch below.
   --------------------------------------------------------------------------- */
export async function loadCatalog(): Promise<ProviderResult> {
  let xtreamError: string | null = null;
  if (config.provider === 'xtream' && config.providerBaseUrl && config.providerUser && config.providerPass) {
    try {
      return await xtreamProvider();
    } catch (e) { xtreamError = e instanceof Error ? e.message : 'unknown error'; }
  }
  /* Xtream unavailable -> try the imported M3U playlist before falling back to demo. */
  try {
    return await m3uProvider();
  } catch (m3uError) {
    return {
      catalog: buildCatalog(Date.now()),
      status: {
        provider: xtreamError ? 'xtream' : 'mock', demo: true, baseUrl: config.providerBaseUrl,
        message: xtreamError
          ? `The configured Xtream provider could not be reached (${xtreamError}), and no M3U playlist has been imported (${m3uError instanceof Error ? m3uError.message : 'empty'}). Serving the labelled demo catalogue instead.`
          : 'No live provider is configured yet. Connect an Xtream API panel or import an M3U playlist in Admin, or set SPORTS_PROVIDER plus SPORTS_API_BASE_URL / SPORTS_API_USER / SPORTS_API_PASS. All demo payloads are flagged demo:true.'
      }
    };
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
