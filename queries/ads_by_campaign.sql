-- Question: which ad campaign earns clicks, and at what cost?
select campaign_name, sum(spend)::float8 as spend, sum(impressions)::int as impressions,
       sum(clicks)::int as clicks, sum(leads)::int as leads
from li_ad_sets_daily where day between :from and :to group by 1 order by clicks desc, impressions desc
