-- Question: when do we gain followers? One row per week (Monday start).
select date_trunc('week', day)::date::text as week, sum(new_followers)::int as new_followers
from li_organic_followers where day between :from and :to group by 1 order by 1
