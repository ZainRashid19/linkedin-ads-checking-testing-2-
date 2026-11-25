-- Question: which organic posts got the most reach? Top 10 in the period. Source lists the top 50 posts only.
select post_date::text as post_date, post_url, impressions, engagements
from li_organic_posts where post_date between :from and :to and impressions is not null order by impressions desc limit 10
