import nextEnv from "@next/env";
import { existsSync, readFileSync } from "node:fs";

nextEnv.loadEnvConfig(process.cwd());
const env = process.env;
let errors = 0;
let warnings = 0;

function pass(label) { console.log("PASS " + label); }
function fail(label) { console.log("FAIL " + label); errors++; }
function warn(label) { console.log("WARN " + label); warnings++; }
function check(label, ok) { ok ? pass(label) : fail(label); }

function httpsOrigin(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && u.pathname === "/" && !u.search && !u.hash;
  } catch { return false; }
}
function placeholder(value) {
  return !value || /REPLACE|YOUR-|example\.com|000000|тохируулаагүй/i.test(String(value));
}

const major = Number(process.versions.node.split(".")[0]);
check("Node.js 22 or 24", major === 22 || major === 24);
check("NEXT_PUBLIC_SITE_NAME configured", !placeholder(env.NEXT_PUBLIC_SITE_NAME));
check("SITE_URL is a public HTTPS origin", httpsOrigin(env.SITE_URL));
check("SUPABASE_URL is HTTPS", httpsOrigin(env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL));

const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || "";
let serviceKey = key.startsWith("sb_secret_") && key.length > 25;
try { serviceKey ||= JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role === "service_role"; } catch {}
check("Supabase server secret configured", serviceKey && !placeholder(key));
check("ADMIN_PASSWORD is unique and 16+ chars", (env.ADMIN_PASSWORD || "").length >= 16 && !placeholder(env.ADMIN_PASSWORD));
check("BANK_NAME configured", !placeholder(env.BANK_NAME));
check("BANK_ACCOUNT configured", /^[A-Za-z0-9 -]{6,40}$/.test(env.BANK_ACCOUNT || "") && !placeholder(env.BANK_ACCOUNT));
check("BANK_ACCOUNT_NAME configured", (env.BANK_ACCOUNT_NAME || "").trim().length >= 2 && !placeholder(env.BANK_ACCOUNT_NAME));

const smsSecret = (env.SMS_WEBHOOK_SECRET || "").trim();
const smsSender = (env.SMS_ALLOWED_SENDER || "").trim();
if (!smsSecret && !smsSender) pass("SMS automation disabled cleanly");
else {
  check("SMS_WEBHOOK_SECRET is 32+ chars", smsSecret.length >= 32 && !placeholder(smsSecret));
  check("SMS_ALLOWED_SENDER configured", !!smsSender);
}

check("No privileged NEXT_PUBLIC secrets",
  !Object.entries(env).some(([k, v]) => k.startsWith("NEXT_PUBLIC_") && /SECRET|SERVICE_ROLE|PASSWORD|ADMIN_PIN|SMS_WEBHOOK/i.test(k) && v));
check("Fresh-install SQL exists", existsSync("supabase/CLIENT-FRESH-INSTALL.sql"));
check("Lockfile exists", existsSync("package-lock.json"));
if (existsSync(".env.local")) pass(".env.local exists"); else warn(".env.local missing - run CLIENT-SETUP.cmd first");

const pkg = JSON.parse(readFileSync("package.json", "utf8"));
check("Production build/start scripts present", pkg.scripts?.build === "next build" && pkg.scripts?.start === "next start");

console.log("");
console.log("Result: " + errors + " error(s), " + warnings + " warning(s).");
console.log("This checks configuration shape only. Run the Supabase SQL and a real payment/watch test before handover.");
process.exitCode = errors ? 1 : 0;
