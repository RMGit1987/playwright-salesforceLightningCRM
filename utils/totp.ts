import { createHmac } from 'crypto';

type TotpAlgorithm = 'SHA1' | 'SHA256' | 'SHA512';

type TotpConfig = {
  secret: string;
  digits?: number;
  period?: number;
  algorithm?: TotpAlgorithm;
};

function normalizeBase32(secret: string): string {
  return secret.toUpperCase().replace(/[\s-]+/g, '').replace(/=+$/g, '');
}

function decodeBase32(secret: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = normalizeBase32(secret);
  let bits = '';

  for (const char of normalized) {
    const index = alphabet.indexOf(char);
    if (index === -1) {
      throw new Error(`Unsupported Base32 character "${char}" in TOTP secret.`);
    }
    bits += index.toString(2).padStart(5, '0');
  }

  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }

  return Buffer.from(bytes);
}

function parsePositiveInteger(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseAlgorithm(value: string | null): TotpAlgorithm {
  const normalized = (value || 'SHA1').toUpperCase();
  if (normalized === 'SHA256' || normalized === 'SHA512') return normalized;
  return 'SHA1';
}

function parseOtpAuthUri(uri: string): TotpConfig {
  const url = new URL(uri);
  if (url.protocol !== 'otpauth:') {
    throw new Error('TOTP URI must use the otpauth:// scheme.');
  }

  const secret = url.searchParams.get('secret');
  if (!secret) {
    throw new Error('TOTP URI is missing the secret query parameter.');
  }

  return {
    secret,
    digits: parsePositiveInteger(url.searchParams.get('digits'), 6),
    period: parsePositiveInteger(url.searchParams.get('period'), 30),
    algorithm: parseAlgorithm(url.searchParams.get('algorithm')),
  };
}

function buildCounterBuffer(counter: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeUInt32BE(Number((counter >> 32n) & 0xffffffffn), 0);
  buffer.writeUInt32BE(Number(counter & 0xffffffffn), 4);
  return buffer;
}

export function generateTotpCode(config: TotpConfig, atTimeMs: number = Date.now()): string {
  const digits = config.digits ?? 6;
  const period = config.period ?? 30;
  const algorithm = (config.algorithm ?? 'SHA1').toLowerCase();
  const secret = decodeBase32(config.secret);
  const counter = BigInt(Math.floor(atTimeMs / 1000 / period));
  const digest = createHmac(algorithm, secret).update(buildCounterBuffer(counter)).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  const code = binary % 10 ** digits;
  return String(code).padStart(digits, '0');
}

export function resolveSalesforceMfaCodeFromEnv(): string | undefined {
  const directCode = process.env.SALESFORCE_MFA_CODE?.trim();
  if (directCode) return directCode;

  const otpAuthUri = process.env.SALESFORCE_TOTP_URI?.trim();
  if (otpAuthUri) {
    return generateTotpCode(parseOtpAuthUri(otpAuthUri));
  }

  const secret = process.env.SALESFORCE_TOTP_SECRET?.trim();
  if (!secret) return undefined;

  return generateTotpCode({
    secret,
    digits: parsePositiveInteger(process.env.SALESFORCE_TOTP_DIGITS || null, 6),
    period: parsePositiveInteger(process.env.SALESFORCE_TOTP_PERIOD || null, 30),
    algorithm: parseAlgorithm(process.env.SALESFORCE_TOTP_ALGORITHM || null),
  });
}
