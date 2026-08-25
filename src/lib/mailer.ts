import nodemailer from "nodemailer";

interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

  return transporter;
}

export async function sendEmail({ to, subject, html, text }: SendOptions) {
  const t = getTransporter();
  if (!t) {
    throw new Error("SMTP configuration missing (SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS)");
  }

  return t.sendMail({
    from: process.env.EMAIL_FROM || SMTP_USER,
    to,
    subject,
    text,
    html,
  });
}

export async function sendResetEmail(to: string, resetUrl: string) {
  const subject = "OtoPiyasa - Şifre sıfırlama bağlantısı";
  const html = `<p>Şifre sıfırlama isteğiniz alındı. Aşağıdaki bağlantıya tıklayarak yeni şifre oluşturabilirsiniz:</p>
    <p><a href="${resetUrl}">${resetUrl}</a></p>
    <p>Bu bağlantı 60 dakika içinde geçersiz olacaktır.</p>`;
  const text = `Şifre sıfırlama: ${resetUrl}`;

  return sendEmail({ to, subject, html, text });
}

export function isMailerConfigured() {
  return getTransporter() !== null;
}

export async function sendVerifyEmail(to: string, verifyUrl: string) {
  const subject = "OtoPiyasa - E-posta adresini doğrula";
  const html = `<p>OtoPiyasa'ya hoş geldin! Hesabını etkinleştirmek için aşağıdaki bağlantıya tıkla:</p>
    <p><a href="${verifyUrl}">E-postamı doğrula</a></p>
    <p>Ya da bu adresi tarayıcına yapıştır:<br>${verifyUrl}</p>
    <p style="color:#888;font-size:12px">Bu bağlantı 24 saat geçerlidir. Bu isteği sen yapmadıysan e-postayı yok sayabilirsin.</p>`;
  const text = `E-posta doğrulama: ${verifyUrl}`;

  return sendEmail({ to, subject, html, text });
}

export async function sendPriceDropEmail(
  to: string,
  options: { title: string; oldPrice: string; newPrice: string; url: string }
) {
  const subject = `OtoPiyasa - Favori aracında fiyat düştü: ${options.title}`;
  const html = `<p>Favorilerine eklediğin <strong>${options.title}</strong> ilanının fiyatı düştü!</p>
    <p style="font-size:18px"><s>${options.oldPrice}</s> → <strong style="color:#059669">${options.newPrice}</strong></p>
    <p><a href="${options.url}">İlanı görüntüle</a></p>
    <p style="color:#888;font-size:12px">Bu bildirimi aracı favorilerine eklediğin için aldın.</p>`;
  const text = `${options.title}: ${options.oldPrice} → ${options.newPrice} | ${options.url}`;

  return sendEmail({ to, subject, html, text });
}

export async function sendListingRejectedEmail(
  to: string,
  options: { title: string; reason: string }
) {
  const subject = "OtoPiyasa - İlanın yayınlanamadı";
  const html = `<p><strong>${options.title}</strong> başlıklı ilanın yayın kurallarımıza uymadığı için yayınlanamadı.</p>
    <p style="background:#fff4f4;border-left:3px solid #e11d48;padding:8px 12px"><strong>Sebep:</strong> ${options.reason}</p>
    <p>İlanı düzenleyip tekrar gönderebilirsin. Sorun için bize ulaşabilirsin.</p>`;
  const text = `İlanın (${options.title}) yayınlanamadı. Sebep: ${options.reason}`;
  return sendEmail({ to, subject, html, text });
}

export async function sendBusinessDecisionEmail(
  to: string,
  options: { approved: boolean; businessName: string; reason?: string }
) {
  const subject = options.approved
    ? "OtoPiyasa - İşletme hesabın onaylandı"
    : "OtoPiyasa - İşletme hesabı başvurun";
  const html = options.approved
    ? `<p><strong>${options.businessName}</strong> işletme hesabın onaylandı! 🎉</p>
       <p>Artık ilanlarında "İşletme" rozeti ve firma adın görünecek.</p>`
    : `<p><strong>${options.businessName}</strong> işletme hesabı başvurun onaylanmadı.</p>
       ${options.reason ? `<p style="background:#fff4f4;border-left:3px solid #e11d48;padding:8px 12px"><strong>Sebep:</strong> ${options.reason}</p>` : ""}
       <p>Bilgilerini güncelleyip tekrar başvurabilirsin.</p>`;
  const text = options.approved
    ? `İşletme hesabın (${options.businessName}) onaylandı.`
    : `İşletme başvurun onaylanmadı. ${options.reason || ""}`;
  return sendEmail({ to, subject, html, text });
}

export async function sendNewCommentEmail(
  to: string,
  options: { carTitle: string; commenterName: string; text: string; url: string }
) {
  const subject = `OtoPiyasa - İlanına yeni yorum: ${options.carTitle}`;
  const html = `<p><strong>${options.commenterName}</strong>, <strong>${options.carTitle}</strong> ilanına yorum yaptı:</p>
    <blockquote style="border-left:3px solid #f0b23c;padding:6px 12px;color:#444">${options.text}</blockquote>
    <p><a href="${options.url}">İlanı ve yorumu görüntüle</a></p>`;
  const text = `${options.commenterName} yorum yaptı: ${options.text} | ${options.url}`;
  return sendEmail({ to, subject, html, text });
}


export async function sendEmailChangeCode(
  to: string,
  options: { code: string; stage: "current" | "new"; newEmail?: string }
) {
  const subject =
    options.stage === "current"
      ? "OtoPiyasa - E-posta değişikliği doğrulama kodu"
      : "OtoPiyasa - Yeni e-posta adresini doğrula";
  const html =
    options.stage === "current"
      ? `<p>Hesabının e-posta adresini <strong>${options.newEmail}</strong> olarak değiştirme isteği aldık. Bu işlemi SEN başlattıysan aşağıdaki kodu uygulamaya gir:</p>
         <p style="font-size:28px;font-weight:800;letter-spacing:6px">${options.code}</p>
         <p style="color:#888;font-size:12px">Kod 15 dakika geçerlidir. Bu isteği sen yapmadıysan hiçbir şey yapmana gerek yok; hesabın e-postası bu kod girilmeden değişmez.</p>`
      : `<p>Bu adresi OtoPiyasa hesabına yeni e-posta olarak eklemek üzeresin. Adresin gerçekten sana ait olduğunu doğrulamak için aşağıdaki kodu uygulamaya gir:</p>
         <p style="font-size:28px;font-weight:800;letter-spacing:6px">${options.code}</p>
         <p style="color:#888;font-size:12px">Kod 15 dakika geçerlidir.</p>`;
  const text = `Doğrulama kodun: ${options.code}`;
  return sendEmail({ to, subject, html, text });
}


function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


export async function sendListingPublishedEmail(
  to: string,
  options: { title: string; url: string }
) {
  const subject = `OtoPiyasa - İlanın yayınlandı: ${options.title}`;
  const html = `<p><strong>${escapeHtml(options.title)}</strong> ilanın denetimden geçti ve yayınlandı. 🎉</p>
    <p>Artık alıcılar ilanını görebilir, soru sorabilir ve teklif verebilir.
    Teklif geldiğinde sana hem bildirim hem e-posta göndereceğiz.</p>
    <p><a href="${options.url}">İlanı görüntüle</a></p>`;
  const text = `İlanın yayınlandı: ${options.title} | ${options.url}`;
  return sendEmail({ to, subject, html, text });
}


export async function sendNewOfferEmail(
  to: string,
  options: { carTitle: string; buyerName: string; amount: number; url: string }
) {
  const amount = options.amount.toLocaleString("tr-TR");
  const subject = `OtoPiyasa - Yeni teklif: ${options.carTitle}`;
  const html = `<p><strong>${escapeHtml(options.buyerName)}</strong>, <strong>${escapeHtml(
    options.carTitle
  )}</strong> ilanın için teklif verdi:</p>
    <p style="font-size:20px;font-weight:700">${amount} ₺</p>
    <p>Teklifi kabul edebilir ya da reddedebilirsin. Kabul edersen alıcıyla 48 saat boyunca mesajlaşabilirsin.</p>
    <p><a href="${options.url}">Teklifi görüntüle</a></p>`;
  const text = `${options.buyerName} ${amount} TL teklif verdi: ${options.url}`;
  return sendEmail({ to, subject, html, text });
}


export async function sendOfferDecisionEmail(
  to: string,
  options: { carTitle: string; amount: number; accepted: boolean; url: string }
) {
  const amount = options.amount.toLocaleString("tr-TR");
  const subject = options.accepted
    ? `OtoPiyasa - Teklifin kabul edildi: ${options.carTitle}`
    : `OtoPiyasa - Teklifin reddedildi: ${options.carTitle}`;
  const html = options.accepted
    ? `<p><strong>${escapeHtml(options.carTitle)}</strong> ilanı için verdiğin <strong>${amount} ₺</strong> teklif KABUL EDİLDİ. 🎉</p>
       <p>Satıcıyla mesajlaşma <strong>48 saat</strong> boyunca açık. Bu sürede anlaşmayı netleştirebilirsin.</p>
       <p><a href="${options.url}">Sohbeti aç</a></p>`
    : `<p><strong>${escapeHtml(options.carTitle)}</strong> ilanı için verdiğin <strong>${amount} ₺</strong> teklif reddedildi.</p>
       <p>Dilersen yeni bir teklif gönderebilirsin.</p>
       <p><a href="${options.url}">İlana git</a></p>`;
  const text = options.accepted
    ? `Teklifin kabul edildi (${amount} TL). 48 saat mesajlaşabilirsin: ${options.url}`
    : `Teklifin reddedildi (${amount} TL): ${options.url}`;
  return sendEmail({ to, subject, html, text });
}


export async function sendNewQuestionEmail(
  to: string,
  options: { carTitle: string; askerName: string; text: string; url: string }
) {
  const subject = `OtoPiyasa - İlanına yeni soru: ${options.carTitle}`;
  const html = `<p><strong>${escapeHtml(options.askerName)}</strong>, <strong>${escapeHtml(
    options.carTitle
  )}</strong> ilanın hakkında soru sordu:</p>
    <blockquote style="border-left:3px solid #f0b23c;padding:6px 12px;color:#444">${escapeHtml(
      options.text
    )}</blockquote>
    <p><a href="${options.url}">Soruyu yanıtla</a></p>`;
  const text = `${options.askerName} soru sordu: ${options.text} | ${options.url}`;
  return sendEmail({ to, subject, html, text });
}


export async function sendQuestionAnsweredEmail(
  to: string,
  options: { carTitle: string; question: string; answer: string; url: string }
) {
  const subject = `OtoPiyasa - Sorun yanıtlandı: ${options.carTitle}`;
  const html = `<p><strong>${escapeHtml(options.carTitle)}</strong> ilanı hakkındaki sorun yanıtlandı.</p>
    <p><em>Soru:</em> ${escapeHtml(options.question)}</p>
    <blockquote style="border-left:3px solid #f0b23c;padding:6px 12px;color:#444">${escapeHtml(
      options.answer
    )}</blockquote>
    <p><a href="${options.url}">İlana git</a></p>`;
  const text = `Sorun yanıtlandı: ${options.answer} | ${options.url}`;
  return sendEmail({ to, subject, html, text });
}

export default { sendEmail, sendResetEmail, sendPriceDropEmail };
