import crypto from 'crypto';
import { OtpChallenge } from '../models/index.js';
import { sendOtpEmail } from './email.service.js';

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

const hashOtp = (code: string): string =>
  crypto.createHash('sha256').update(`${code}:${process.env.JWT_SECRET || 'otp'}`).digest('hex');

const generateOtpCode = (): string =>
  String(crypto.randomInt(100000, 1000000));

/** Emails used for local/staging testing — always logged to the terminal. */
export function isOtpTestEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const configured = (process.env.OTP_TEST_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (configured.length > 0) {
    return configured.includes(normalized);
  }

  return normalized.endsWith('@fossilzim.com');
}

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
 * Send a login OTP. Test emails are always logged; failed delivery is logged everywhere.
 */
export async function deliverLoginOtp(email: string, code: string): Promise<void> {
  const isTest = isOtpTestEmail(email);

  if (isTest) {
    await logOtpDelivery(email, code, 'test account — also attempting email');
  }

  const sent = await sendOtpEmail(email, code);

  if (sent) {
    if (isTest) {
      console.log(`[OTP] Email sent to test address ${email}`);
    }
    return;
  }

  if (process.env.NODE_ENV === 'production' && !isTest) {
    console.log(`[OTP] Email delivery failed for ${email}. Code: ${code}`);
    return;
  }

  if (!isTest) {
    await logOtpDelivery(email, code, 'email delivery failed — use code above');
  }
}

export async function createLoginOtp(user: { _id: any; email: string }): Promise<void> {
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
}

export async function verifyLoginOtp(
  email: string,
  code: string
): Promise<{ userId: string } | null> {
  const challenge = await OtpChallenge.findOne({
    email: email.trim().toLowerCase(),
    purpose: 'login',
    used: false,
    expiresAt: { $gt: new Date() }
  }).sort({ createdAt: -1 });

  if (!challenge) {
    return null;
  }

  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    challenge.used = true;
    await challenge.save();
    return null;
  }

  const valid = challenge.codeHash === hashOtp(code.trim());
  challenge.attempts += 1;

  if (!valid) {
    await challenge.save();
    return null;
  }

  challenge.used = true;
  await challenge.save();
  return { userId: challenge.user.toString() };
}
