import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

/**
 * Nodemailer transporter configured for Resend SMTP.
 * Resend docs: https://resend.com/docs/send-with-nodemailer
 */
const transporter = nodemailer.createTransport({
  host: "smtp.resend.com",
  port: 465,
  secure: true,
  auth: {
    user: "resend",
    pass: process.env.RESEND_API_KEY,
  },
});

/**
 * Sends a verification email with a unique link.
 * The link hits: /api/v1/auth/verify?token=<token>
 */
export async function sendVerificationEmail(to, token) {
  const verificationLink = `${process.env.FRONTEND_URL}/verify?token=${token}`;

  const mailOptions = {
    from: "OpenMap <noreply@getopenmap.com>",
    to,
    subject: "Verify your OpenMap account",
    html: `
      <p>Hello,</p>
      <p>Thank you for signing up for OpenMap. Please verify your email by clicking the link below:</p>
      <a href="${verificationLink}">Verify</a>
      <p>This link will expire in 15 minutes for your security.</p>
      <p>- The OpenMap Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent to ${to}`);
  } catch (error) {
    console.error("❌ Failed to send verification email:", error);
    throw error;
  }
}

/**
 * Sends a confirmation link to the *new* address a user wants to switch to.
 * The address only becomes their login once this link is opened, which proves
 * they can actually receive mail there.
 */
export async function sendEmailChangeVerification(to, token) {
  const confirmLink = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;

  const mailOptions = {
    from: "OpenMap <noreply@getopenmap.com>",
    to,
    subject: "Confirm your new OpenMap email address",
    html: `
      <p>Hello,</p>
      <p>You asked to change the email address on your OpenMap account to this one. Confirm the change by clicking the link below:</p>
      <a href="${confirmLink}">Confirm new email</a>
      <p>This link expires in 24 hours. Until you confirm, your account keeps using your old address.</p>
      <p>If you didn't request this, you can safely ignore this email.</p>
      <p>- The OpenMap Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Email change confirmation sent to ${to}`);
  } catch (error) {
    console.error("❌ Failed to send email change confirmation:", error);
    throw error;
  }
}

export async function sendPasswordResetEmail(to, token) {
  const resetLink = `${process.env.FRONTEND_URL}/reset?token=${token}`;

  const mailOptions = {
    from: "OpenMap <noreply@getopenmap.com>",
    to,
    subject: "Reset your OpenMap account password",
    html: `
      <p>Hello,</p>
      <p>Please use the link below to reset your password:</p>
      <a href="${resetLink}">Reset</a>
      <p>This link will expire in 15 minutes(?!?!?!?!?) for your security.</p>
      <p>- The OpenMap Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${to}`);
  } catch (error) {
    console.error("❌ Failed to send password reset email:", error);
    throw error;
  }
}

/**
 * Sends a payment/subscription confirmation email after a successful checkout.
 * Triggered by the Stripe webhook on `checkout.session.completed`.
 */
export async function sendPaymentConfirmation(to, details = {}) {
  const {
    planName = "Subscription",
    amount = "0.00",
    currency = "USD",
    interval = "month",
  } = details;

  const cadence = interval === "year" || interval === "yearly" ? "yearly" : "monthly";
  const accountLink = `${process.env.FRONTEND_URL}/account`;

  const mailOptions = {
    from: "OpenMap <noreply@getopenmap.com>",
    to,
    subject: `Your OpenMap ${planName} subscription is active`,
    html: `
      <p>Hello,</p>
      <p>Thank you for subscribing to OpenMap! Your payment was successful and your plan is now active.</p>
      <ul>
        <li><strong>Plan:</strong> ${planName}</li>
        <li><strong>Amount:</strong> ${amount} ${String(currency).toUpperCase()}</li>
        <li><strong>Billing:</strong> ${cadence}</li>
      </ul>
      <p>You can manage your subscription anytime from your account: <a href="${accountLink}">${accountLink}</a></p>
      <p>- The OpenMap Team</p>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Payment confirmation email sent to ${to}`);
  } catch (error) {
    console.error("❌ Failed to send payment confirmation email:", error);
    // Don't rethrow: the subscription is already paid; email failure must not 500 the webhook.
  }
}
