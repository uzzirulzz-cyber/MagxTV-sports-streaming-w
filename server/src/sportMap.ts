/* Single source of truth for mapping provider group names onto the platform's
   sport taxonomy. Shared by the Xtream adapter, the M3U importer and the router. */
import type { SportId } from './providers/catalog';

export const GROUP_HINTS: [SportId, RegExp][] = [
  ['cricket', /\b(cricket|icc|ipl|bbl|ashes|t20)\b/i],
  ['basketball', /\b(basket|nba|euroleague|ncaa)\b/i],
  ['tennis', /\b(tennis|atp|wta|grand slam)\b/i],
  ['motorsport', /\b(f1|formula|motogp|motorsport|racing|nascar)\b/i],
  ['football', /\b(football|soccer|epl|premier|liga|serie|bundesliga|uefa|sports)\b/i]
];

export function sportFromGroup(name: string): SportId {
  for (const [sport, re] of GROUP_HINTS) if (re.test(name)) return sport;
  return 'football';
}
