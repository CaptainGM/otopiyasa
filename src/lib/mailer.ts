import nodemailer, { type Transporter } from "nodemailer";

interface SendOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

function getInitialPort(): number {
  if (process.env.SMTP_PORT) {
    const p = Number(process.env.SMTP_PORT);
    // Render ve bulut sunucularda STARTTLS (587 veya 2525) DPI gecikmesi ve TLS zaman aşımına yol açabilir.
    // Brevo için doğrudan SSL/TLS kullanan 465 portu en kararlı ve hızlı olanıdır.
    if (process.env.RENDER && (SMTP_HOST || "").includes("brevo")) {
      return 465;
    }
    return p;
  }
  // Brevo kullanıldığında doğrudan güvenli 465 portu tercih edilir (STARTTLS gecikmesi olmaz)
  if ((SMTP_HOST || "").includes("brevo")) return 465;
  return 587;
}

let activePort = getInitialPort();
let transporter: Transporter | null = null;

function createTransporter(port: number): Transporter | null {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    pool: false, // Bulut ortamında (Render) boştaki havuz bağlantıları sessizce kopup TLS zaman aşımı yaratmasın
    connectionTimeout: 6_000,
    greetingTimeout: 6_000,
    socketTimeout: 8_000,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    tls: {
      servername: SMTP_HOST,
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
    },
  });
}

function getTransporter(): Transporter | null {
  if (transporter) return transporter;
  transporter = createTransporter(activePort);
  return transporter;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Bağlantı adresi: yalnızca http(s) kabul edilir, öznitelik için kaçışlanır. */
export function safeUrl(value: string): string {
  const url = String(value || "");
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : "#";
}

const e = escapeHtml;

export async function sendEmail({ to, subject, html, text }: SendOptions) {
  // 1. Resend REST API (varsa HTTPS / Port 443 üzerinden gönderir, port engeline takılmaz)
  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || "OtoPiyasa <bilgi@otopiyasa.app>",
        to: [to],
        subject: subject.replace(/[\r\n]+/g, " ").slice(0, 200),
        html,
        text,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Resend API hatası: ${(err && typeof err === "object" && "message" in err ? String(err.message) : "") || res.statusText}`);
    }
    return;
  }

  // 2. Brevo REST API (varsa HTTPS / Port 443 üzerinden gönderir)
  if (process.env.BREVO_API_KEY) {
    const fromAddr = process.env.EMAIL_FROM || SMTP_USER || "bilgi@otopiyasa.app";
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": process.env.BREVO_API_KEY,
        "Content-Type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: { email: fromAddr, name: "OtoPiyasa" },
        to: [{ email: to }],
        subject: subject.replace(/[\r\n]+/g, " ").slice(0, 200),
        htmlContent: html,
        textContent: text,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Brevo API hatası: ${(err && typeof err === "object" && "message" in err ? String(err.message) : "") || res.statusText}`);
    }
    return;
  }

  // 3. SMTP (Nodemailer)
  const mailOptions = {
    from: process.env.EMAIL_FROM || SMTP_USER,
    to,
    subject: subject.replace(/[\r\n]+/g, " ").slice(0, 200),
    text,
    html,
  };

  const isBrevo = (SMTP_HOST || "").includes("brevo");
  const fallbackOrder = isBrevo ? [465, 2525, 587] : [activePort, 587, 465, 2525];
  const portsToTry: number[] = [];
  if (activePort && !portsToTry.includes(activePort)) portsToTry.push(activePort);
  for (const p of fallbackOrder) {
    if (!portsToTry.includes(p)) portsToTry.push(p);
  }

  let lastError: unknown;
  for (const port of portsToTry) {
    try {
      const current = port === activePort && transporter ? transporter : createTransporter(port);
      if (!current) continue;
      const result = await current.sendMail(mailOptions);
      activePort = port;
      transporter = current;
      return result;
    } catch (error) {
      lastError = error;
      console.warn(`sendEmail port ${port} hatası, alternatif deneniyor:`, error instanceof Error ? error.message : error);
    }
  }

  throw lastError;
}

export async function sendResetEmail(to: string, resetUrl: string) {
  const subject = "OtoPiyasa - Şifre sıfırlama bağlantısı";
  const html = `<p>Şifre sıfırlama isteğiniz alındı. Aşağıdaki bağlantıya tıklayarak yeni şifre oluşturabilirsiniz:</p>
    <p><a href="${safeUrl(resetUrl)}">${e(resetUrl)}</a></p>
    <p>Bu bağlantı 60 dakika içinde geçersiz olacaktır.</p>`;
  const text = `Şifre sıfırlama: ${resetUrl}`;

  return sendEmail({ to, subject, html, text });
}

export async function sendResetCodeEmail(to: string, code: string) {
  const subject = "OtoPiyasa - Şifre sıfırlama kodu";
  const html = `<p>Şifre sıfırlama isteğiniz alındı. Uygulamaya aşağıdaki kodu girerek yeni şifre belirleyebilirsiniz:</p>
    <p style="font-size:28px;font-weight:800;letter-spacing:6px">${e(code)}</p>
    <p style="color:#888;font-size:12px">Kod 15 dakika geçerlidir. Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz; şifreniz değişmez.</p>`;
  const text = `Şifre sıfırlama kodun: ${code}`;

  return sendEmail({ to, subject, html, text });
}

export function isMailerConfigured() {
  return Boolean(
    process.env.RESEND_API_KEY ||
    process.env.BREVO_API_KEY ||
    (SMTP_HOST && SMTP_USER && SMTP_PASS)
  );
}

/** SMTP sunucusuna bağlanıp kimlik doğrular; e-posta GÖNDERMEZ (günlük kotayı harcamaz). */
export async function verifyMailerConnection(timeoutMs = 15_000): Promise<void> {
  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/api-keys", {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    });
    if (!res.ok && res.status !== 403) throw new Error(`Resend API hatası: HTTP ${res.status}`);
    return;
  }

  if (process.env.BREVO_API_KEY) {
    const res = await fetch("https://api.brevo.com/v3/account", {
      headers: { "api-key": process.env.BREVO_API_KEY, accept: "application/json" },
    });
    if (!res.ok) throw new Error(`Brevo API hatası: HTTP ${res.status}`);
    return;
  }

  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    throw new Error("SMTP ayarları yok");
  }

  const isBrevo = (SMTP_HOST || "").includes("brevo");
  const fallbackOrder = isBrevo ? [465, 2525, 587] : [activePort, 587, 465, 2525];
  const portsToTry: number[] = [];
  if (activePort && !portsToTry.includes(activePort)) portsToTry.push(activePort);
  for (const p of fallbackOrder) {
    if (!portsToTry.includes(p)) portsToTry.push(p);
  }

  let lastError: Error | null = null;
  const perPortTimeout = Math.min(Math.floor(timeoutMs / portsToTry.length) + 1500, 6_000);

  for (const port of portsToTry) {
    const candidate = createTransporter(port);
    if (!candidate) continue;

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        candidate.verify(),
        new Promise<void>((_, reject) => {
          timer = setTimeout(() => reject(new Error(`${Math.round(perPortTimeout / 1000)} sn içinde yanıt vermedi (Port ${port})`)), perPortTimeout);
        }),
      ]);
      // Başarılı portu hatırla ve aktif yap
      activePort = port;
      transporter = candidate;
      return;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  throw lastError || new Error("SMTP sunucusuna bağlanılamadı");
}

export async function sendVerifyEmail(to: string, verifyUrl: string) {
  const subject = "OtoPiyasa - E-posta adresini doğrula";
  const html = `<p>OtoPiyasa'ya hoş geldin! Hesabını etkinleştirmek için aşağıdaki bağlantıya tıkla:</p>
    <p><a href="${safeUrl(verifyUrl)}">E-postamı doğrula</a></p>
    <p>Ya da bu adresi tarayıcına yapıştır:<br>${e(verifyUrl)}</p>
    <p style="color:#888;font-size:12px">Bu bağlantı 24 saat geçerlidir. Bu isteği sen yapmadıysan e-postayı yok sayabilirsin.</p>`;
  const text = `E-posta doğrulama: ${verifyUrl}`;

  return sendEmail({ to, subject, html, text });
}

export async function sendPriceDropEmail(
  to: string,
  options: { title: string; oldPrice: string; newPrice: string; url: string }
) {
  const subject = `OtoPiyasa - Favori aracında fiyat düştü: ${options.title}`;
  const html = `<p>Favorilerine eklediğin <strong>${e(options.title)}</strong> ilanının fiyatı düştü!</p>
    <p style="font-size:18px"><s>${e(options.oldPrice)}</s> → <strong style="color:#059669">${e(options.newPrice)}</strong></p>
    <p><a href="${safeUrl(options.url)}">İlanı görüntüle</a></p>
    <p style="color:#888;font-size:12px">Bu bildirimi aracı favorilerine eklediğin için aldın.</p>`;
  const text = `${options.title}: ${options.oldPrice} → ${options.newPrice} | ${options.url}`;

  return sendEmail({ to, subject, html, text });
}

export async function sendListingRejectedEmail(
  to: string,
  options: { title: string; reason: string }
) {
  const subject = "OtoPiyasa - İlanın yayınlanamadı";
  const html = `<p><strong>${e(options.title)}</strong> başlıklı ilanın yayın kurallarımıza uymadığı için yayınlanamadı.</p>
    <p style="background:#fff4f4;border-left:3px solid #e11d48;padding:8px 12px"><strong>Sebep:</strong> ${e(options.reason)}</p>
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
    ? `<p><strong>${e(options.businessName)}</strong> işletme hesabın onaylandı! 🎉</p>
       <p>Artık ilanlarında "İşletme" rozeti ve firma adın görünecek.</p>`
    : `<p><strong>${e(options.businessName)}</strong> işletme hesabı başvurun onaylanmadı.</p>
       ${options.reason ? `<p style="background:#fff4f4;border-left:3px solid #e11d48;padding:8px 12px"><strong>Sebep:</strong> ${e(options.reason)}</p>` : ""}
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
  const html = `<p><strong>${e(options.commenterName)}</strong>, <strong>${e(options.carTitle)}</strong> ilanına yorum yaptı:</p>
    <blockquote style="border-left:3px solid #f0b23c;padding:6px 12px;color:#444">${e(options.text)}</blockquote>
    <p><a href="${safeUrl(options.url)}">İlanı ve yorumu görüntüle</a></p>`;
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
      ? `<p>Hesabının e-posta adresini <strong>${e(options.newEmail)}</strong> olarak değiştirme isteği aldık. Bu işlemi SEN başlattıysan aşağıdaki kodu uygulamaya gir:</p>
         <p style="font-size:28px;font-weight:800;letter-spacing:6px">${e(options.code)}</p>
         <p style="color:#888;font-size:12px">Kod 15 dakika geçerlidir. Bu isteği sen yapmadıysan hiçbir şey yapmana gerek yok; hesabın e-postası bu kod girilmeden değişmez.</p>`
      : `<p>Bu adresi OtoPiyasa hesabına yeni e-posta olarak eklemek üzeresin. Adresin gerçekten sana ait olduğunu doğrulamak için aşağıdaki kodu uygulamaya gir:</p>
         <p style="font-size:28px;font-weight:800;letter-spacing:6px">${e(options.code)}</p>
         <p style="color:#888;font-size:12px">Kod 15 dakika geçerlidir.</p>`;
  const text = `Doğrulama kodun: ${options.code}`;
  return sendEmail({ to, subject, html, text });
}


export async function sendListingPublishedEmail(
  to: string,
  options: { title: string; url: string }
) {
  const subject = `OtoPiyasa - İlanın yayınlandı: ${options.title}`;
  const html = `<p><strong>${e(options.title)}</strong> ilanın denetimden geçti ve yayınlandı. 🎉</p>
    <p>Artık alıcılar ilanını görebilir, soru sorabilir ve teklif verebilir.
    Teklif geldiğinde sana hem bildirim hem e-posta göndereceğiz.</p>
    <p><a href="${safeUrl(options.url)}">İlanı görüntüle</a></p>`;
  const text = `İlanın yayınlandı: ${options.title} | ${options.url}`;
  return sendEmail({ to, subject, html, text });
}


export async function sendNewOfferEmail(
  to: string,
  options: { carTitle: string; buyerName: string; amount: number; url: string }
) {
  const amount = options.amount.toLocaleString("tr-TR");
  const subject = `OtoPiyasa - Yeni teklif: ${options.carTitle}`;
  const html = `<p><strong>${e(options.buyerName)}</strong>, <strong>${e(options.carTitle)}</strong> ilanın için teklif verdi:</p>
    <p style="font-size:20px;font-weight:700">${e(amount)} ₺</p>
    <p>Teklifi kabul edebilir ya da reddedebilirsin. Kabul edersen alıcıyla 48 saat boyunca mesajlaşabilirsin.</p>
    <p><a href="${safeUrl(options.url)}">Teklifi görüntüle</a></p>`;
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
    ? `<p><strong>${e(options.carTitle)}</strong> ilanı için verdiğin <strong>${e(amount)} ₺</strong> teklif KABUL EDİLDİ. 🎉</p>
       <p>Satıcıyla mesajlaşma <strong>48 saat</strong> boyunca açık. Bu sürede anlaşmayı netleştirebilirsin.</p>
       <p><a href="${safeUrl(options.url)}">Sohbeti aç</a></p>`
    : `<p><strong>${e(options.carTitle)}</strong> ilanı için verdiğin <strong>${e(amount)} ₺</strong> teklif reddedildi.</p>
       <p>Dilersen yeni bir teklif gönderebilirsin.</p>
       <p><a href="${safeUrl(options.url)}">İlana git</a></p>`;
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
  const html = `<p><strong>${e(options.askerName)}</strong>, <strong>${e(options.carTitle)}</strong> ilanın hakkında soru sordu:</p>
    <blockquote style="border-left:3px solid #f0b23c;padding:6px 12px;color:#444">${e(options.text)}</blockquote>
    <p><a href="${safeUrl(options.url)}">Soruyu yanıtla</a></p>`;
  const text = `${options.askerName} soru sordu: ${options.text} | ${options.url}`;
  return sendEmail({ to, subject, html, text });
}


export async function sendQuestionAnsweredEmail(
  to: string,
  options: { carTitle: string; question: string; answer: string; url: string }
) {
  const subject = `OtoPiyasa - Sorun yanıtlandı: ${options.carTitle}`;
  const html = `<p><strong>${e(options.carTitle)}</strong> ilanı hakkındaki sorun yanıtlandı.</p>
    <p><em>Soru:</em> ${e(options.question)}</p>
    <blockquote style="border-left:3px solid #f0b23c;padding:6px 12px;color:#444">${e(options.answer)}</blockquote>
    <p><a href="${safeUrl(options.url)}">İlana git</a></p>`;
  const text = `Sorun yanıtlandı: ${options.answer} | ${options.url}`;
  return sendEmail({ to, subject, html, text });
}

const mailer = { sendEmail, sendResetEmail, sendPriceDropEmail };
export default mailer;
