const INTEGER_NONCE = /("nonce"\s*:\s*)(-?[0-9]+)/g;

/**
 * Preserve Technocore nonces exactly before JavaScript's JSON parser can round
 * integers above Number.MAX_SAFE_INTEGER.
 */
export function parseTechnocoreJson(source: string): Record<string, unknown> {
  return JSON.parse(source.replace(INTEGER_NONCE, '$1"$2"')) as Record<string, unknown>;
}
