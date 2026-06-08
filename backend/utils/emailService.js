const nodemailer = require('nodemailer');

// Create a reusable transporter
const createTransporter = () => {
    // If required SMTP env vars are not set, use a JSON transport that just logs the email payload.
    const requiredVars = ['EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_USER', 'EMAIL_PASS'];
    const missing = requiredVars.filter(v => !process.env[v]);
    if (missing.length > 0) {
        console.warn('⚠️ Email configuration missing (' + missing.join(', ') + '). Using placeholder transporter.');
        // jsonTransport writes the message to console instead of sending.
        return nodemailer.createTransport({ jsonTransport: true });
    }
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: parseInt(process.env.EMAIL_PORT) || 587,
        secure: false, // TLS
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

/**
 * Send OTP email for password reset
 */
const sendOtpEmail = async (toEmail, otp) => {
    const transporter = createTransporter();

    const mailOptions = {
        from: `"Anika Pharmacy" <${process.env.EMAIL_USER}>`,
        to: toEmail,
        subject: '🔐 Your Anika Pharmacy OTP Code',
        html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>OTP Verification</title>
        </head>
        <body style="margin:0;padding:0;background:#0b0f19;font-family:'Segoe UI',Arial,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0f19;padding:40px 0;">
            <tr>
              <td align="center">
                <table width="480" cellpadding="0" cellspacing="0" style="background:#151d30;border-radius:16px;border:1px solid #334155;overflow:hidden;">
                  <!-- Header -->
                  <tr>
                    <td style="background:linear-gradient(135deg,#0ea5e9,#06b6d4);padding:32px;text-align:center;">
                      <div style="font-size:36px;margin-bottom:8px;">💊</div>
                      <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:800;">Anika Pharmacy</h1>
                      <p style="margin:4px 0 0;color:rgba(255,255,255,0.8);font-size:12px;letter-spacing:2px;text-transform:uppercase;">Password Reset</p>
                    </td>
                  </tr>
                  <!-- Body -->
                  <tr>
                    <td style="padding:32px;text-align:center;">
                      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 24px;">
                        We received a request to reset your password. Use this one-time OTP code:
                      </p>
                      <!-- OTP Box -->
                      <div style="background:#0b0f19;border:2px dashed #06b6d4;border-radius:12px;padding:24px;margin:0 auto 24px;max-width:220px;">
                        <div style="font-size:40px;font-weight:900;letter-spacing:16px;color:#06b6d4;text-indent:16px;">${otp}</div>
                      </div>
                      <p style="color:#64748b;font-size:12px;margin:0 0 8px;">
                        ⏱️ This OTP expires in <strong style="color:#f59e0b;">10 minutes</strong>
                      </p>
                      <p style="color:#64748b;font-size:12px;margin:0;">
                        If you didn't request this, please ignore this email.
                      </p>
                    </td>
                  </tr>
                  <!-- Footer -->
                  <tr>
                    <td style="background:#111827;padding:20px;text-align:center;border-top:1px solid #334155;">
                      <p style="color:#475569;font-size:11px;margin:0;">
                        Anika Pharmacy Management Portal • Secure Authentication
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        `
    };

    try {
        try {
            await transporter.sendMail(mailOptions);
            console.log(`✅ OTP email sent to ${toEmail}`);
        } catch (sendErr) {
            console.warn('⚠️ Real email send failed, falling back to console transport:', sendErr.message);
            // Use JSON transport to output the email content to console for dev/debug
            const fallbackTransport = nodemailer.createTransport({ jsonTransport: true });
            await fallbackTransport.sendMail(mailOptions);
            console.log(`✅ OTP email (fallback) logged for ${toEmail}. OTP: ${otp}`);
        }
    } catch (emailErr) {
        console.error('❌ Failed to send OTP email:', emailErr.message);
        // Still resolve so that the caller can decide how to handle.
    }
};

module.exports = { sendOtpEmail };
