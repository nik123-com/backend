const nodemailer = require("nodemailer");

// Create and cache transporter
let transporter = null;

const getTransporter = () => {
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").trim();

  if (!user || !pass) {
    throw new Error("SMTP_USER or SMTP_PASS is missing in environment variables. Please set SMTP_USER and SMTP_PASS in your Render Environment settings.");
  }

  // Use port 465 SSL which is most reliable across environments
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: user,
      pass: pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
};

/**
 * Base email sender
 */
const sendMail = async ({ to, subject, html, text }) => {
  try {
    const user = (process.env.SMTP_USER || "").trim();
    if (!transporter) {
      transporter = getTransporter();
    }

    const mailOptions = {
      from: `"Aventra Support" <${user}>`,
      to: to.trim(),
      subject: subject,
      text: text,
      html: html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully to", to, "MessageId:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error("❌ Nodemailer sendMail error:", err);
    // If connection dropped, reset transporter for retry on next call
    transporter = null;
    throw err;
  }
};

/**
 * Send 6-Digit OTP Email for Login / Portal Access
 */
const sendOtpEmail = async ({ to, otp, name, purpose = "Portal Login" }) => {
  const greeting = name ? `Hello ${name},` : "Hello,";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your OTP Verification Code</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333333;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f6f9; padding: 30px 15px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              <!-- Header -->
              <tr>
                <td align="center" style="background: linear-gradient(135deg, #78c214 0%, #5a940f 100%); padding: 35px 20px; color: #ffffff;">
                  <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">Aventra</h1>
                  <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">Secure ${purpose} Verification</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding: 35px 30px;">
                  <p style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #1f2937;">${greeting}</p>
                  <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.5; color: #4b5563;">
                    Use the One-Time Password (OTP) below to authenticate and access your account. This code is valid for <strong>10 minutes</strong>.
                  </p>

                  <!-- OTP Display Box -->
                  <div style="background: #f0fdf4; border: 2px dashed #86efac; border-radius: 12px; padding: 22px 10px; text-align: center; margin-bottom: 25px;">
                    <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #166534; font-family: 'Courier New', monospace; display: inline-block;">
                      ${otp}
                    </span>
                  </div>

                  <p style="margin: 0 0 12px; font-size: 13px; color: #6b7280; line-height: 1.5;">
                    🔒 If you did not request this OTP, please disregard this email. Never share your OTP with anyone.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
                  <p style="margin: 0;">© ${new Date().getFullYear()} Aventra. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `${greeting}\n\nYour One-Time Password (OTP) for ${purpose} is: ${otp}\n\nThis OTP is valid for 10 minutes. Do not share it with anyone.`;

  return sendMail({
    to,
    subject: `Your ${purpose} OTP Code: ${otp}`,
    html,
    text,
  });
};

/**
 * Send Password Reset Email with direct 1-click Reset Link
 */
const sendPasswordResetEmail = async ({ to, resetUrl, name }) => {
  const greeting = name ? `Hello ${name},` : "Hello,";
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333333;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f6f9; padding: 30px 15px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              <!-- Header -->
              <tr>
                <td align="center" style="background: linear-gradient(135deg, #78c214 0%, #5a940f 100%); padding: 35px 20px; color: #ffffff;">
                  <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">Aventra</h1>
                  <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.9;">Password Reset Request</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding: 35px 30px;">
                  <p style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #1f2937;">${greeting}</p>
                  <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.5; color: #4b5563;">
                    You are receiving this because you requested the reset of the password for your account. Please click the button below to set a new password:
                  </p>

                  <!-- Reset Button -->
                  <div style="text-align: center; margin-bottom: 28px;">
                    <a href="${resetUrl}" style="background-color: #78c214; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 16px; display: inline-block;">Reset Password</a>
                  </div>

                  <p style="font-size: 13px; color: #6b7280; line-height: 1.5; margin-bottom: 18px;">
                    Or copy and paste this URL into your browser: <br/>
                    <a href="${resetUrl}" style="color: #5a940f; word-break: break-all;">${resetUrl}</a>
                  </p>

                  <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
                    If you did not request a password reset, please ignore this email and your password will remain unchanged. This link is valid for 1 hour.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
                  <p style="margin: 0;">© ${new Date().getFullYear()} Aventra. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `${greeting}\n\nYou requested a password reset for your Aventra account.\n\nPlease click the following link to reset your password:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email.`;

  return sendMail({
    to,
    subject: "Password Reset Request - Aventra",
    html,
    text,
  });
};

/**
 * Send Welcome Email upon registration
 */
const sendWelcomeEmail = async ({ to, name }) => {
  const greeting = name ? `Welcome to Aventra, ${name}!` : "Welcome to Aventra!";
  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: Arial, sans-serif; background-color: #f4f6f9; padding: 20px; color: #333;">
      <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
        <div style="background-color: #78c214; padding: 24px; text-align: center; color: white;">
          <h2 style="margin: 0;">Aventra</h2>
        </div>
        <div style="padding: 24px;">
          <h3>${greeting}</h3>
          <p>Your customer account has been registered successfully. Explore exclusive products, smart deals, and AI-powered recommendations.</p>
          <p>Happy shopping!</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendMail({
    to,
    subject: "Welcome to Aventra! Your Account is Ready",
    html,
    text: `${greeting}\n\nYour account has been registered successfully at Aventra. Enjoy shopping!`,
  });
};

/**
 * Send Order Confirmation Email to the customer's registered email
 */
const sendOrderConfirmationEmail = async ({
  to,
  name,
  orderId,
  items = [],
  grandTotal,
  paymentMethod,
  paymentStatus,
  address,
  portalUrl,
}) => {
  const greeting = name ? `Hello ${name},` : "Hello,";
  const itemsHtml = items.length > 0
    ? items.map(item => `
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 10px 0; font-size: 14px; color: #1e293b;">
            <strong>${item.name || "Product"}</strong>
            <span style="color: #64748b; font-size: 12px; display: block;">Qty: ${item.quantity || 1}</span>
          </td>
          <td style="padding: 10px 0; font-size: 14px; text-align: right; color: #1e293b; font-weight: 600;">
            ₹${item.price ? (item.price * (item.quantity || 1)).toLocaleString('en-IN') : '0'}
          </td>
        </tr>
      `).join("")
    : `<tr><td colspan="2" style="padding: 10px 0; color: #64748b;">Order details confirmed</td></tr>`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Confirmation #${orderId}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #333333;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f6f9; padding: 30px 15px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
              <!-- Header -->
              <tr>
                <td align="center" style="background: linear-gradient(135deg, #78c214 0%, #5a940f 100%); padding: 32px 20px; color: #ffffff;">
                  <div style="font-size: 38px; margin-bottom: 6px;">🎉</div>
                  <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Order Placed Successfully!</h1>
                  <p style="margin: 6px 0 0; font-size: 15px; opacity: 0.95;">Order #${orderId}</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding: 30px;">
                  <p style="margin: 0 0 14px; font-size: 16px; font-weight: 600; color: #1f2937;">${greeting}</p>
                  <p style="margin: 0 0 20px; font-size: 15px; line-height: 1.5; color: #4b5563;">
                    Thank you for your purchase! We've received your order and are currently processing it. You can track this order directly in your customer portal.
                  </p>

                  <!-- Order Summary Box -->
                  <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin-bottom: 24px;">
                    <div style="font-size: 13px; font-weight: 700; color: #475569; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">Order Summary</div>
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      ${itemsHtml}
                      <tr>
                        <td style="padding: 12px 0 4px; font-size: 15px; font-weight: 700; color: #0f172a; border-top: 2px solid #e2e8f0;">Total Amount:</td>
                        <td style="padding: 12px 0 4px; font-size: 18px; font-weight: 800; text-align: right; color: #166534; border-top: 2px solid #e2e8f0;">₹${Number(grandTotal).toLocaleString('en-IN')}</td>
                      </tr>
                      <tr>
                        <td style="padding: 4px 0; font-size: 13px; color: #64748b;">Payment Method:</td>
                        <td style="padding: 4px 0; font-size: 13px; text-align: right; color: #0f172a; font-weight: 600;">${paymentMethod || "COD"} (${paymentStatus || "Pending"})</td>
                      </tr>
                      ${address ? `
                      <tr>
                        <td style="padding: 6px 0 0; font-size: 13px; color: #64748b; vertical-align: top;">Delivery Address:</td>
                        <td style="padding: 6px 0 0; font-size: 13px; text-align: right; color: #0f172a;">${address}</td>
                      </tr>` : ''}
                    </table>
                  </div>

                  <!-- CTA Button -->
                  <div style="text-align: center; margin-bottom: 20px;">
                    <a href="${portalUrl || 'http://localhost:5173/myorders'}" style="background-color: #78c214; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block;">
                      View & Track in Your Portal
                    </a>
                  </div>

                  <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.5;">
                    Live tracking and invoice details are available on your Aventra Customer Portal.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background-color: #f9fafb; padding: 20px 30px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
                  <p style="margin: 0;">© ${new Date().getFullYear()} Aventra. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendMail({
    to,
    subject: `Order #${orderId} Confirmed - Aventra`,
    html,
    text: `${greeting}\n\nYour order #${orderId} has been placed successfully!\nTotal: ₹${grandTotal}\nPayment: ${paymentMethod}\n\nTrack your order in your customer portal: ${portalUrl || 'http://localhost:5173/myorders'}`,
  });
};

module.exports = {
  sendMail,
  sendOtpEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendOrderConfirmationEmail,
};
