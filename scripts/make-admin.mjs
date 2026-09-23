import mongoose from "mongoose";
import { readFileSync } from "fs";
import path from "path";

const email = process.argv[2];
if (!email) {
  console.error("Kullanım: node scripts/make-admin.mjs <email>");
  process.exit(1);
}

const projectRoot = path.resolve(import.meta.dirname, "..");
let envUri = process.env.MONGODB_URI;
try {
  const env = Object.fromEntries(
    readFileSync(path.join(projectRoot, ".env"), "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => {
        const index = line.indexOf("=");
        return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
      })
  );
  if (env.MONGODB_URI) envUri = env.MONGODB_URI;
} catch {}

const MONGODB_URI = envUri || "mongodb://127.0.0.1:27017/otopiyasa";

const UserSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    passwordHash: String,
    role: { type: String, enum: ["user", "admin"], default: "user" },
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model("User", UserSchema);

async function makeAdmin() {
  await mongoose.connect(MONGODB_URI);

  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase() },
    { role: "admin" },
    { new: true }
  );

  if (!user) {
    console.error(`Kullanıcı bulunamadı: ${email}`);
    process.exit(1);
  }

  console.log(`${user.email} artık admin. Yeniden giriş yapması gerekir.`);
  await mongoose.disconnect();
}

makeAdmin().catch((error) => {
  console.error(error);
  process.exit(1);
});
