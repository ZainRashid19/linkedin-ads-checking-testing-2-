-- Question: how many companies engaged through posts (organic), saw ads (paid), or both? Latest export.
select count(*) filter (where organic_engagements > 0)::int as engaged_organic,
  count(*) filter (where paid_impressions > 0)::int as saw_ads,
  count(*) filter (where organic_engagements > 0 and paid_impressions > 0)::int as both,
  count(*)::int as total
from li_companies where snapshot_date = (select max(snapshot_date) from li_companies)
