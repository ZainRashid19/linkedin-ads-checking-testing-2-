-- Question: is organic reach growing? One row per day.
select day::text as day, impressions::int as impressions, engagements::int as engagements
from li_organic_daily where day between :from and :to order by day
