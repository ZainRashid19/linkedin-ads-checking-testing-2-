-- Question: which companies are heating up? Compares the latest export with the one before it by engagement level and organic engagements. Only compares exports that cover the same number of days. Empty until two such exports are loaded.
with snaps as (select distinct snapshot_date d from li_companies
  where window_days is not null and window_days = (select window_days from li_companies where snapshot_date = (select max(snapshot_date) from li_companies) limit 1)
  order by d desc limit 2),
cur as (select * from li_companies where snapshot_date = (select max(d) from snaps)),
prv as (select * from li_companies where snapshot_date = (select min(d) from snaps) and (select count(*) from snaps) = 2)
select c.company, c.page_url, p.engagement_level as was, c.engagement_level as now,
  coalesce(c.organic_engagements,0) - coalesce(p.organic_engagements,0) as organic_change,
  coalesce(c.paid_impressions,0) - coalesce(p.paid_impressions,0) as paid_change
from cur c join prv p using (company)
where coalesce(c.organic_engagements,0) > coalesce(p.organic_engagements,0) or coalesce(c.paid_impressions,0) > coalesce(p.paid_impressions,0)
order by 5 desc, 6 desc limit 25
