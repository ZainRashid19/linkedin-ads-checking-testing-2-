-- Paid spend and clicks per day.
select day::text as day, sum(spend)::float8 as spend, sum(clicks)::int as clicks, sum(impressions)::int as impressions
from li_ad_sets_daily where day between :from and :to group by 1 order by 1
