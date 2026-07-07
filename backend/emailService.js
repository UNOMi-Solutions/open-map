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
      <a href="${verificationLink}">${verificationLink}</a>
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

/*

export async function sendPasswordResetEmail(to, token) {
  const resetLink = `${process.env.FRONTEND_URL}/resetPassword?token=${token}`;

  const mailOptions = {
    from: "OpenMap <noreply@getopenmap.com>",
    to,
    subject: "Reset your OpenMap account password",
    html: `
      <p>Hello,</p>
      <p>Please use the link below to reset your password:</p>
      <a href="${resetLink}">${resetLink}</a>
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

*/
