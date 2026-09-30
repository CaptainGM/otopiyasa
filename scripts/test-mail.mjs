
import nodemailer from "nodemailer";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    })
);

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM } = env;
if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
  console.error("Eksik SMTP ayarı: .env içindeki SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS doldurulmalı.");
  process.exit(1);
}

const to = process.argv[2] || SMTP_USER;
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: Number(SMTP_PORT),
  secure: Number(SMTP_PORT) === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

try {
  await transporter.verify();
  console.log("SMTP bağlantısı OK, test e-postası gönderiliyor:", to);
  const info = await transporter.sendMail({
    from: EMAIL_FROM || SMTP_USER,
    to,
    subject: "OtoPiyasa - SMTP testi başarılı ✔",
    text: "Bu bir test e-postasıdır. SMTP ayarların çalışıyor; fiyat alarmı ve kayıtlı arama bildirimleri artık gönderilebilir.",
  });
  console.log("Gönderildi:", info.messageId);
} catch (error) {
  console.error("SMTP testi başarısız:", error.message);
  process.exit(1);
}
