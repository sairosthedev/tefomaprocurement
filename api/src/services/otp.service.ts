import crypto from 'crypto';
import { OtpChallenge } from '../models/index.js';
import { sendOtpEmail } from './email.service.js';

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

const hashOtp = (code: string): string =>
  crypto.createHash('sha256').update(`${code}:${process.env.JWT_SECRET || 'otp'}`).digest('hex');

const generateOtpCode = (): string =>
  String(crypto.randomInt(100000, 1000000));

async function logOtpDelivery(email: string, code: string, reason: string): Promise<void> {
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
 * Send a login OTP. Always logs the code to the server console for testing.
 */
export async function deliverLoginOtp(email: string, code: string): Promise<void> {
  await logOtpDelivery(email, code, 'testing — check server console');

  const sent = await sendOtpEmail(email, code);
  if (sent) {
    console.log(`[OTP] Email sent to ${email}`);
  } else {
    console.log(`[OTP] Email delivery failed for ${email} — use console code above`);
  }
}

/** Testing only — include OTP in login API response for browser console. Set OTP_EXPOSE_IN_RESPONSE=false to disable. */
export function shouldExposeOtpInResponse(): boolean {
  return process.env.OTP_EXPOSE_IN_RESPONSE !== 'false';
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
