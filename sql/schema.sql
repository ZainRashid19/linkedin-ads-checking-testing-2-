-- One row = one ad set (or ad) on one day, with that day's results.
create table if not exists li_ad_sets_daily (
  day date, campaign_id text, campaign_name text, campaign_status text,
  ad_set_id text, ad_set_name text, objective text,
  spend numeric, impressions integer, clicks integer, reactions integer, comments integer, shares integer, follows integer,
  total_engagements integer, leads integer, conversions integer, reach integer, video_views integer, landing_page_clicks integer
);
create table if not exists li_ads_daily (
  day date, campaign_id text, campaign_name text, campaign_status text,
  ad_set_id text, ad_set_name text, objective text,
  ad_id text, ad_name text, ad_status text, ad_headline text, ad_text text, post_type text,
  spend numeric, impressions integer, clicks integer, reactions integer, comments integer, shares integer, follows integer,
  total_engagements integer, leads integer, conversions integer, reach integer, video_views integer, landing_page_clicks integer
);
-- One row = one audience segment (a company, job title, industry ...) over the whole period.
create table if not exists li_audience (
  dimension text, segment text, impressions integer, clicks integer, conversions integer
);
-- No public policies: only the server (connection string) can read these.
alter table li_ad_sets_daily enable row level security;
alter table li_ads_daily enable row level security;
alter table li_audience enable row level security;

-- One row = Dripify outreach totals for one period (a month or a week, see period_type).
create table if not exists dripify_stats (
  campaign text, source_file text, period_type text, period_start date, period_end date,
  invites_sent integer, invites_accepted integer, messaged integer, inmailed integer, leads_replied integer,
  emails_sent integer, profiles_followed integer, endorsed integer, liked integer, profiles_viewed integer
);
alter table dripify_stats enable row level security;

alter table dripify_stats add column if not exists campaign text;

-- One row = one ManyReach campaign, totals as shown on its shared report page (typed from screenshots).
create table if not exists manyreach_campaigns (
  campaign text, first_day date, last_day date, reached integer, opened integer, replied integer, opportunities_usd numeric, source text
);
alter table manyreach_campaigns enable row level security;

-- LinkedIn organic (personal profile). person = whose profile the export came from.
create table if not exists li_organic_daily (person text, day date, impressions integer, engagements integer);
create table if not exists li_organic_followers (person text, day date, new_followers integer);
create table if not exists li_organic_posts (
  person text, post_url text, post_date date, post_type text, impressions integer, engagements integer, members_reached integer,
  reactions integer, comments integer, reposts integer, saves integer, followers_gained integer
);
create table if not exists li_organic_demographics (person text, audience text, category text, value text, percent_text text, percent numeric);
alter table li_organic_daily enable row level security;
alter table li_organic_followers enable row level security;
alter table li_organic_posts enable row level security;
alter table li_organic_demographics enable row level security;

-- LinkedIn Campaign Manager company engagement export. One row per company per export (snapshot_date = day exported),
-- so trends appear once a second export is loaded.
create table if not exists li_companies (
  snapshot_date date, company text, page_url text, engagement_level text,
  organic_impressions integer, organic_engagements integer,
  paid_impressions integer, paid_clicks integer, paid_engagements integer, paid_video_views integer,
  paid_conversions integer, paid_leads integer, paid_qualified_leads integer
);
alter table li_companies enable row level security;

-- Replies a person judged positive (interested, asked for a call or info). Null = not counted yet.
alter table manyreach_campaigns add column if not exists positive_replies integer;

-- MQL list loaded from data/voiant - mqls.xlsx. section: mql | other (existing relationships) | meeting.
create table if not exists mqls (
  position integer, section text, when_label text, when_date date, name text, title text, company text, section_note text
);
alter table mqls enable row level security;

-- channel: how an MQL found us. source: where a meeting was set up.
alter table mqls add column if not exists channel text;
alter table mqls add column if not exists source text;

-- How many days the company export covered (null = not stated). Trends only compare exports of the same length.
alter table li_companies add column if not exists window_days integer;

-- Where a meeting commitment stands (scheduler sent, meeting booked ...).
alter table mqls add column if not exists status text;

-- One row per automatic sync run, so the dashboard can say when each source was last refreshed.
create table if not exists sync_log (source text, ran_at timestamptz default now(), ok boolean, rows integer, message text);
alter table sync_log enable row level security;

-- One row per Dripify campaign per sync (totals as of taken_at), so weekly change can be worked out later.
create table if not exists dripify_snapshots (
  taken_at timestamptz default now(), campaign_id bigint, campaign text, status text,
  total_leads integer, contacted integer, accepted integer, replied integer
);
alter table dripify_snapshots enable row level security;

-- Single row (id = 1) holding the LinkedIn Ads OAuth tokens for the one authorized member.
-- access_token is short-lived (~60 days); refresh_token (if LinkedIn grants one) renews it without a reauth click.
create table if not exists linkedin_oauth_tokens (
  id integer primary key default 1,
  access_token text not null, refresh_token text, expires_at timestamptz not null,
  scope text, authorized_at timestamptz default now(),
  constraint linkedin_oauth_tokens_singleton check (id = 1)
);
alter table linkedin_oauth_tokens enable row level security;
