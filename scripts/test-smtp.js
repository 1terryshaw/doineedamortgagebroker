/**
 * SMTP Connection Test
 *
 * Tests whether nodemailer can connect to Gmail SMTP.
 * Usage: node scripts/test-smtp.js
 *
 * Requires GMAIL_USER and GMAIL_APP_PASSWORD env vars.
 */

const nodemailer = require("nodemailer");

async function testSmtpConnection() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;

  console.log("=== SMTP Connection Test ===\n");

  if (!user || !pass) {
    console.error("GMAIL_USER:", user ? "SET" : "NOT SET");
    console.error("GMAIL_APP_PASSWORD:", pass ? "SET" : "NOT SET");
    console.error("\nFix: Set both GMAIL_USER and GMAIL_APP_PASSWORD environment variables.");
    process.exit(1);
  }

  console.log("GMAIL_USER:", user);
  console.log("GMAIL_APP_PASSWORD: SET (hidden)\n");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  try {
    console.log("Verifying SMTP connection...");
    await transporter.verify();
    console.log("SMTP connection successful! Nodemailer can send emails.");
  } catch (error) {
    console.error("SMTP connection FAILED:", error.message);
    console.error("\nCommon fixes:");
    console.error("  1. Enable 2-Step Verification on Google Account");
    console.error("  2. Generate an App Password at https://myaccount.google.com/apppasswords");
    console.error("  3. Use the App Password (not your regular password) for GMAIL_APP_PASSWORD");
    process.exit(1);
  }
}

testSmtpConnection();
