// Make an expiring link that opens the dashboard without the password. Usage: node scripts/share-link.mjs [hours=24]
// Anyone with the link can view every page until it expires. Changing DASHBOARD_PASSWORD cancels all links early.
import { createHmac } from "node:crypto";
process.loadEnvFile(".env.local");
const hours = Number(process.argv[2] ?? 24);
if (!(hours > 0 && hours <= 168)) { console.error("Hours must be between 0 and 168."); process.exit(1); }
const exp = String(Date.now() + hours * 3600_000);
const sig = createHmac("sha256", process.env.DASHBOARD_PASSWORD).update(`voiant-share-v1:${exp}`).digest("hex");
console.log(`https://voiant-marketing-dashboard.vercel.app/s/${exp}.${sig}`);
console.log("Expires:", new Date(Number(exp)).toString());
