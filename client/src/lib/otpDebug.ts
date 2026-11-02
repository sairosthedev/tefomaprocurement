/** Log OTP to the browser devtools console during testing. */
export function logOtpToBrowserConsole(email: string, code: string): void {
  console.log(
    `%c LOGIN OTP (testing) `,
    'background:#1e40af;color:#fff;font-weight:bold;padding:2px 6px;border-radius:4px;',
    `\nEmail: ${email}\nCode:  ${code}\nExpires in 10 minutes`
  );
}
