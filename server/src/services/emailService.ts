import nodemailer from "nodemailer";
import { getOptionalEnv } from "../config/env";
import { logInfo, logWarn } from "../utils/logger";

interface EmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

const smtpHost = getOptionalEnv("SMTP_HOST");
const smtpPort = Number.parseInt(getOptionalEnv("SMTP_PORT", "587"), 10);
const smtpUser = getOptionalEnv("SMTP_USER");
const smtpPass = getOptionalEnv("SMTP_PASS");
const smtpFrom = getOptionalEnv("SMTP_FROM", "no-reply@okrtracker.com");
const appBaseUrl = getOptionalEnv("APP_BASE_URL", "http://localhost:5173");

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (!smtpHost) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: smtpUser && smtpPass ? { user: smtpUser, pass: smtpPass } : undefined
    });
  }
  return transporter;
}

export async function sendEmail(payload: EmailPayload) {
  const activeTransporter = getTransporter();
  if (!activeTransporter) {
    logWarn("email", `SMTP not configured. Email to ${payload.to} logged instead.`);
    logInfo("email", `Subject: ${payload.subject}`);
    logInfo("email", payload.text);
    return;
  }

  await activeTransporter.sendMail({
    from: smtpFrom,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html
  });
}

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${appBaseUrl}/verify-email?token=${token}`;
  const subject = "Verify your OKR Tracker account";
  const text = `Welcome to OKR Tracker! Verify your email to activate your account: ${verifyUrl}`;
  const html = `<p>Welcome to OKR Tracker!</p><p>Verify your email to activate your account:</p><p><a href="${verifyUrl}">Verify Email</a></p>`;
  await sendEmail({ to: email, subject, text, html });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetUrl = `${appBaseUrl}/reset-password?token=${token}`;
  const subject = "Reset your OKR Tracker password";
  const text = `Reset your password using this link: ${resetUrl}`;
  const html = `<p>Reset your OKR Tracker password:</p><p><a href="${resetUrl}">Reset Password</a></p>`;
  await sendEmail({ to: email, subject, text, html });
}
