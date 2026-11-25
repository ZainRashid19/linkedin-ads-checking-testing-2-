-- Question: which companies are most engaged with us right now? Latest export, ranked by level then organic engagements, then paid impressions. Top 40.
select company, page_url, engagement_level as level,
  coalesce(organic_impressions,0)::int as organic_impressions, coalesce(organic_engagements,0)::int as organic_engagements,
  coalesce(paid_impressions,0)::int as paid_impressions, coalesce(paid_clicks,0)::int as paid_clicks, coalesce(paid_engagements,0)::int as paid_engagements
from li_companies where snapshot_date = (select max(snapshot_date) from li_companies)
order by case engagement_level when 'Very High' then 1 when 'High' then 2 when 'Medium' then 3 when 'Low' then 4 else 5 end,
  coalesce(organic_engagements,0) desc, coalesce(paid_impressions,0) desc, company limit 40
