# LinkedIn Ads automation — going from demo to real data

The Ads tab, OAuth routes and sync job are already built and committed. What's in this repo right now runs
against **mock data only** — nothing here has touched a real LinkedIn account. To switch it to Voiant's real
ad account, you (or your Claude) need to do exactly this:

## 1. LinkedIn developer app (Faheem does this — see his Oct 2026 email for the full checklist)
- App created at linkedin.com/developers/apps/new, linked to the Voiant company page, verified by Alex.
- Products tab → apply for **Advertising API**, Development tier.
- Ad account `558608822` added to the app by Faheem.
- On the Auth tab, redirect URL set to: `https://<your-vercel-domain>/api/linkedin/callback`

## 2. Environment variables (set in Vercel → Project → Settings → Environment Variables)
| Variable | Value |
|---|---|
| `LINKEDIN_CLIENT_ID` | from the app's Auth tab |
| `LINKEDIN_CLIENT_SECRET` | from the app's Auth tab — Faheem said not to send this over email/chat; have him paste it directly into Vercel |
| `LINKEDIN_REDIRECT_URI` | `https://<your-vercel-domain>/api/linkedin/callback` (must match the app's Auth tab exactly) |
| `LINKEDIN_AD_ACCOUNT_ID` | `558608822` |

Redeploy after setting these (env var changes need a redeploy to take effect).

## 3. Authorize once
Whoever's LinkedIn account has access to ad account `558608822` (Faheem) logs into the dashboard, then visits:

```
/api/linkedin/connect
```

This redirects to LinkedIn's consent screen, then back to `/api/linkedin/callback`, which stores the access +
refresh token in the `linkedin_oauth_tokens` table. You'll see a small JSON confirmation on success.

Re-visit the same URL whenever LinkedIn requires reauthorization (access tokens last ~60 days; if LinkedIn
also grants a refresh token, renewal happens automatically and this step isn't needed until the refresh token
itself expires, around a year).

## 4. Turn off the mock data
```
/api/dev/seed-mock?key=<SEED_SECRET>&action=clear
```
Removes every row this demo seeded (tagged `campaign_id like 'mock-%'`) and the fake sync_log entry. Real data
starts appearing after the next scheduled sync (daily, see `vercel.json`), or trigger it immediately:
```
/api/cron/sync?source=linkedin_ads
```
(needs the `Authorization: Bearer <CRON_SECRET>` header — call it from a terminal, not a browser address bar).

## 5. Verify the field mapping
`lib/sync/linkedin-ads.ts` maps LinkedIn's Ad Analytics response to the existing `li_ads_daily` /
`li_ad_sets_daily` schema. The field names used are LinkedIn's documented ones, but **this hasn't been run
against a live API response yet** — Development-tier apps sometimes return a reduced field set until LinkedIn
reviews the app. After the first real sync, open `/ads` and sanity-check spend/impressions/clicks/leads look
right; if something's null that shouldn't be, check `sync_log.message` for that run and compare against what
LinkedIn's API Explorer (on the Products tab) actually returns for that field.

## 6. Not covered by this automation (still manual, per the brief)
- Company engagement report ("Companies" view) — likely needs a separate LinkedIn product beyond Advertising
  API; not requested here.
- Ad audience breakdowns (job function, seniority, industry, company size) — same Ad Analytics API, different
  pivot; not built in this pass, flag if wanted.
- Hassan's personal-profile analytics — no public API exists for this; keep the weekly manual export.
