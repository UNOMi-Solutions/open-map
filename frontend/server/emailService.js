import dotenv from "dotenv";
dotenv.config();

const EMAILJS_ENDPOINT = "https://api.emailjs.com/api/v1.0/email/send";

async function sendEmailWithEmailJS(templateId, templateParams) {
  const body = {
    service_id: process.env.EMAILJS_SERVICE_ID,
    template_id: templateId,
    user_id: process.env.EMAILJS_PUBLIC_KEY,
    template_params: templateParams,
  };

  const res = await fetch(EMAILJS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`EmailJS error ${res.status}: ${text}`);
  }
}

/**
 * Sponsor templates use: {{first_name}}, {{verification_link}}.
 */
export async function sendVerificationEmail(to, token) {
  const verificationLink = `${process.env.FRONTEND_URL}/verify?token=${token}`;
  const first_name = (to && to.split("@")[0]) || "User";

  await sendEmailWithEmailJS(process.env.EMAILJS_VERIFICATION_TEMPLATE_ID, {
    to_email: to,
    first_name,
    verification_link: verificationLink,
  });
}

/**
 * Subscription purchase confirmation: {{first_name}}, {{plan_name}}, etc.
 */
export async function sendPaymentConfirmation(to, details = {}) {
  const {
    planName = "Subscription",
    amount = "0.00",
    currency = "USD",
    interval = "month",
  } = details;

  const first_name = (to && to.split("@")[0]) || "Subscriber";
  const monthly_or_annual = interval === "year" ? "Annual" : "Monthly";
  const price = `${amount} ${currency}`;
  const account_link = process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL}/account`
    : "#";

  await sendEmailWithEmailJS(process.env.EMAILJS_PAYMENT_TEMPLATE_ID, {
    to_email: to,
    first_name,
    plan_name: planName,
    monthly_or_annual,
    price,
    account_link,
  });
}
