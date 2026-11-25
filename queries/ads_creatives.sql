-- Question: which individual ads work? One row per ad (up to 50).
select ad_id, max(campaign_name) as campaign, coalesce(max(ad_name), '') as ad_name, left(coalesce(max(ad_text), max(ad_headline), ''), 90) as copy,
       max(post_type) as post_type, sum(spend)::float8 as spend, sum(impressions)::int as impressions, sum(clicks)::int as clicks,
       sum(reactions + comments + shares)::int as social_actions
from li_ads_daily where day between :from and :to group by ad_id order by clicks desc, impressions desc limit 50
