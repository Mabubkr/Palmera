/**
 * PalmTrace Mailer Service (خدمة البريد الإلكتروني لمنظومة إدارة النخيل)
 * Supports SMTP (via nodemailer if configured) with fallback to audit outbox log.
 */
const fs = require('node:fs');
const path = require('node:path');

const OUTBOX_LOG = path.join(require('./config').DATA_DIR, 'mail_outbox.log');

// Try loading nodemailer if installed
let nodemailer = null;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  // Nodemailer not installed, will use simulated outbox logging
}

function getTransporter() {
  if (!nodemailer) return null;

  let host = process.env.SMTP_HOST;
  let port = parseInt(process.env.SMTP_PORT || '587', 10);
  let user = process.env.SMTP_USER;
  let pass = process.env.SMTP_PASS;

  try {
    const db = require('./db');
    const rows = db.all('SELECT key, value FROM system_settings WHERE key LIKE "smtp%"');
    const map = {};
    rows.forEach(r => { map[r.key] = r.value; });
    if (map.smtpHost) host = map.smtpHost;
    if (map.smtpPort) port = parseInt(map.smtpPort, 10);
    if (map.smtpUser) user = map.smtpUser;
    if (map.smtpPass) pass = map.smtpPass;
  } catch (e) {}

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
}

async function sendMail({ to, subject, html, text }) {
  const from = process.env.SMTP_FROM || '"منظومة PalmTrace الزراعية" <noreply@palmtrace.farm>';
  const transporter = getTransporter();

  const timestamp = new Date().toISOString();
  const entry = `\n=======================================================\n` +
    `[${timestamp}] To: ${to}\nSubject: ${subject}\n\n${text || html}\n` +
    `=======================================================\n`;

  try {
    fs.appendFileSync(OUTBOX_LOG, entry, 'utf8');
  } catch (err) {
    console.warn('Failed to write to mail outbox:', err.message);
  }

  if (transporter) {
    try {
      const info = await transporter.sendMail({ from, to, subject, text, html });
      console.log(`[Mailer] Email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId, mode: 'smtp' };
    } catch (err) {
      console.warn(`[Mailer] SMTP delivery failed to ${to}:`, err.message);
      return { success: false, error: err.message, mode: 'outbox' };
    }
  }

  console.log(`[Mailer] Email recorded in outbox log for ${to}: ${subject}`);
  return { success: true, mode: 'outbox' };
}

async function sendPasswordResetEmail(targetUser, token, appUrl = 'http://localhost:3000') {
  if (!targetUser.email) return { success: false, reason: 'no_email' };
  const resetUrl = `${appUrl}/?resetToken=${token}`;
  const subject = `🔑 رابط استعادة كلمة المرور - منظومة PalmTrace`;
  const text = `أهلاً بك ${targetUser.full_name || targetUser.username}،\n\nتلقينا طلباً لاستعادة كلمة المرور الخاصة بحسابك في منظومة إدارة النخيل والزيتون PalmTrace.\n\nيمكنك تعيين كلمة مرور جديدة بالضغط على الرابط التالي (صالح لمدة 15 دقيقة):\n${resetUrl}\n\nرمز الاستعادة: ${token}\n\nإذا لم تطلب هذا التغيير، يُرجى تجاهل هذه الرسالة.`;
  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;max-width:550px;margin:0 auto;border:1px solid #E2E8F0;border-radius:12px;padding:24px;background:#FAFAFA">
      <div style="text-align:center;margin-bottom:20px">
        <h2 style="color:#1B5E20;margin:0">🌴 منظومة PalmTrace الزراعية</h2>
        <div style="color:#64748B;font-size:13px;margin-top:4px">إدارة المزارع والنخيل والأصول الميدانية</div>
      </div>
      <div style="background:#FFF;border:1px solid #CBD5E1;border-radius:10px;padding:20px;margin-bottom:20px">
        <h3 style="color:#0F172A;margin-top:0">أهلاً بك يا ${targetUser.full_name || targetUser.username}</h3>
        <p style="color:#475569;line-height:1.7;font-size:14px">
          تلقينا طلباً لاستعادة كلمة المرور الخاصة بحسابك في منظومة <b>PalmTrace</b>. اضغط على الزر أدناه لتعيين كلمة مرور شخصية جديدة لحسابك:
        </p>
        <div style="text-align:center;margin:24px 0">
          <a href="${resetUrl}" style="background:#16A34A;color:#FFF;padding:12px 28px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;font-size:15px">
            تعيين كلمة المرور الجديدة ←
          </a>
        </div>
        <div style="font-size:12px;color:#64748B;background:#F8FAFC;padding:10px;border-radius:6px;border:1px dashed #CBD5E1">
          <b>ملاحظة أمنية:</b> هذا الرابط صالح لمدة <b>15 دقيقة فقط</b>. إذا انتهت صلاحيته يمكنك طلب رابط استعادة جديد من صفحة تسجيل الدخول.
        </div>
      </div>
      <div style="text-align:center;color:#94A3B8;font-size:11px">
        تم إرسال هذا البريد تلقائياً من خادم PalmTrace الداخلي.
      </div>
    </div>
  `;

  return sendMail({ to: targetUser.email, subject, text, html });
}

module.exports = {
  sendMail,
  sendPasswordResetEmail
};
