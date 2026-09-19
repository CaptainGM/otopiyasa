
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/api-rate-limit";


export const AI_LIMITS = {

  chat: { limit: 30, windowMs: 10 * 60 * 1000 },

  compare: { limit: 12, windowMs: 10 * 60 * 1000 },
 
  photo: { limit: 8, windowMs: 30 * 60 * 1000 },
} as const;


export function checkAiRateLimit(
  request: Request,
  bucket: keyof typeof AI_LIMITS
): NextResponse | null {
  return checkRateLimit(request, `ai:${bucket}`, AI_LIMITS[bucket]);
}

const TURKISH_VOWELS = "aeıioöuüAEIİOÖUÜ";


function isRepeatedUnit(letters: string): boolean {
  const s = letters.toLowerCase();
  if (s.length < 6) return false;
  for (let unit = 1; unit <= 4; unit++) {
    if (s.length % unit !== 0) continue;
    const times = s.length / unit;
    if (times < 3) continue;
    const head = s.slice(0, unit);
    if (head.repeat(times) === s) return true;
  }
  return false;
}


export function isJunkMessage(message: string): boolean {
  const text = (message || "").trim();
  if (text.length < 2) return true;

  const letters = text.replace(/[^\p{L}]/gu, "");
  if (letters.length === 0) return true;

  if (/(.)\1{5,}/u.test(text)) return true;

  if (isRepeatedUnit(letters)) return true;

  const longestToken = text.split(/\s+/).reduce((max, t) => Math.max(max, t.length), 0);
  if (longestToken >= 40) return true;


  if (letters.length >= 6) {
    let vowels = 0;
    for (const ch of letters) if (TURKISH_VOWELS.includes(ch)) vowels += 1;
    if (vowels / letters.length < 0.12) return true;
  }

  return false;
}

const DAILY_AI_BUDGET = Number(process.env.AI_DAILY_BUDGET) || 800;

let budgetDay = "";
let budgetUsed = 0;


export function consumeAiBudget(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDay) {
    budgetDay = today;
    budgetUsed = 0;
  }
  if (budgetUsed >= DAILY_AI_BUDGET) return false;
  budgetUsed += 1;
  return true;
}


export function aiBudgetStatus() {
  return { day: budgetDay, used: budgetUsed, limit: DAILY_AI_BUDGET };
}


export function resetAiBudget() {
  budgetDay = "";
  budgetUsed = 0;
}


export const JUNK_REPLY =
  "Tam anlayamadım 🙂 Araç aramak, fiyat sormak ya da öneri istemek için " +
  'yazabilirsin — örneğin "1 milyon altı dizel araba öner" ya da "en ucuz BMW".';
