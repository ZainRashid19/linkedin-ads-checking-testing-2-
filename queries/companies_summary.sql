-- Question: how many companies engage with us, by LinkedIn engagement level? Latest company export only.
select engagement_level as level, count(*)::int as companies,
  coalesce(sum(organic_impressions),0)::int as organic_impressions, coalesce(sum(organic_engagements),0)::int as organic_engagements,
  coalesce(sum(paid_impressions),0)::int as paid_impressions, coalesce(sum(paid_clicks),0)::int as paid_clicks,
  (select max(snapshot_date)::text from li_companies) as snapshot,
  (select max(window_days) from li_companies where snapshot_date = (select max(snapshot_date) from li_companies)) as window_days
from li_companies where snapshot_date = (select max(snapshot_date) from li_companies)
group by 1 order by case engagement_level when 'Very High' then 1 when 'High' then 2 when 'Medium' then 3 when 'Low' then 4 else 5 end
