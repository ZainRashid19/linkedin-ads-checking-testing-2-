// Tidy Dripify statistics exports (data/raw/Dripify*.csv) into data/clean/dripify_stats.csv.
// Handles monthly rows ("Aug - 2026") and weekly rows ("Oct 12, 2026 - Oct 18, 2026"). Skips the Total row.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
const MON = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
const d = (y, m, day) => new Date(Date.UTC(y, m, day)).toISOString().slice(0, 10);
const cols = ["invites_sent","invites_accepted","messaged","inmailed","leads_replied","emails_sent","profiles_followed","endorsed","liked","profiles_viewed"];
// Each export file is one Dripify campaign. Replace the working names with the real campaign names.
const CAMPAIGN = {
  "Dripify statistics for Aug - 2026.csv": "Revenue by Design (Dripify)",
  "Dripify statistics for Oct 12, 2026 - Nov 09, 2026.csv": "AI offering feedback (Dripify)",
};
const out = [["campaign","source_file","period_type","period_start","period_end",...cols].join(",")];
for (const f of readdirSync("data/raw").filter(f => f.startsWith("Dripify"))) {
  const [, ...lines] = readFileSync(`data/raw/${f}`, "utf8").trim().split(/\r?\n/);
  for (const l of lines) {
    const m = l.match(/^(?:"([^"]+)"|([^,]+)),(.*)$/); if (!m) continue;
    const label = (m[1] || m[2]).trim(), nums = m[3];
    if (label.startsWith("Total") || nums.split(",").every(v => +v === 0)) continue; // totals, and periods with no activity
    let t, s, e, r;
    if ((r = label.match(/^(\w{3}) - (\d{4})$/))) { t = "month"; s = d(+r[2], MON[r[1]], 1); e = d(+r[2], MON[r[1]] + 1, 0); }
    else if ((r = label.match(/^(\w{3}) (\d+), (\d{4}) - (\w{3}) (\d+), (\d{4})$/))) { t = "week"; s = d(+r[3], MON[r[1]], +r[2]); e = d(+r[6], MON[r[4]], +r[5]); }
    else continue;
    out.push([`"${CAMPAIGN[f] ?? f}"`, `"${f}"`, t, s, e, nums].join(","));
  }
}
writeFileSync("data/clean/dripify_stats.csv", out.join("\n") + "\n");
console.log(out.length - 1, "rows");
