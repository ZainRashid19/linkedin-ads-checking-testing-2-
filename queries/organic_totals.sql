-- Organic impressions and engagements for the period.
select coalesce(sum(impressions),0)::int as impressions, coalesce(sum(engagements),0)::int as engagements
from li_organic_daily where day between :from and :to
