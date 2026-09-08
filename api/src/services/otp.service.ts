import crypto from 'crypto';
import { OtpChallenge } from '../models/index.js';
import { logger } from '../lib/logger.js';
import { getJwtSecret } from '../config/secrets.js';
import { isDeployed } from '../config/env.js';
import { sendOtpEmail } from './email.service.js';

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

const hashOtp = (code: string): string =>
  crypto.createHash('sha256').update(`${code}:${getJwtSecret()}`).digest('hex');

const generateOtpCode = (): string =>
  String(crypto.randomInt(100000, 1000000));

/**
 * Print the OTP to the server console for local development.
 *
 * Development only: server logs are retained and widely readable, so a plaintext
 * code there is a standing authentication bypass for anyone with log access.
 * Staging counts as deployed — its logs are just as readable.
 */
async function logOtpDelivery(email: string, code: string, reason: string): Promise<void> {
  if (isDeployed()) return;

  const banner = [
    '',
    '========== LOGIN OTP ==========',
    `Email:   ${email}`,
    `Code:    ${code}`,
    `Reason:  ${reason}`,
    `Expires: ${OTP_TTL_MINUTES} minutes`,
    '==============================',
    ''
  ].join('\n');
  console.log(banner);
}

/**
 * Send a login OTP. In development the code is also echoed to the server
 * console so local testing does not depend on email delivery.
 */
export async function deliverLoginOtp(email: string, code: string): Promise<void> {
  await logOtpDelivery(email, code, 'local development — not logged in deployed environments');

  const sent = await sendOtpEmail(email, code);
  if (sent) {
    logger.info('OTP email sent', { email });
  } else {
    logger.error('OTP email delivery failed', { email });
  }
}

/**
 * Testing only — include the OTP in the login API response.
 *
 * Fails CLOSED: the code is exposed only when OTP_EXPOSE_IN_RESPONSE is set
 * explicitly to 'true' AND the process is running in development. Returning the
 * OTP to the caller hands them the second factor, so a missing or malformed
 * value must never enable it, and neither may a deployed environment.
 */
export function shouldExposeOtpInResponse(): boolean {
  if (isDeployed()) return false;
  return process.env.OTP_EXPOSE_IN_RESPONSE === 'true';
}

export async function createLoginOtp(user: { _id: any; email: string }): Promise<string> {
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await OtpChallenge.updateMany(
    { email: user.email.toLowerCase(), purpose: 'login', used: false },
    { $set: { used: true } }
  );

  await OtpChallenge.create({
    email: user.email.toLowerCase(),
    user: user._id,
    codeHash: hashOtp(code),
    purpose: 'login',
    expiresAt
  });

  await deliverLoginOtp(user.email, code);
  return code;
}

export type VerifyLoginOtpResult =
  | { status: 'success'; userId: string }
  | { status: 'invalid_code' }
  | { status: 'unavailable' };

export async function verifyLoginOtp(
  email: string,
  code: string
): Promise<VerifyLoginOtpResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = code.trim();
  const codeHash = hashOtp(normalizedCode);

  const challenge = await OtpChallenge.findOne({
    email: normalizedEmail,
    purpose: 'login',
    used: false,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  if (!challenge) {
    return { status: 'unavailable' };
  }

  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    challenge.used = true;
    await challenge.save();
    return { status: 'unavailable' };
  }

  const valid = challenge.codeHash === codeHash;
  challenge.attempts += 1;

  if (!valid) {
    await challenge.save();
    return { status: 'invalid_code' };
  }

  challenge.used = true;
  await challenge.save();
  return { status: 'success', userId: challenge.user.toString() };
}
