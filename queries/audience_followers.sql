-- Question: who follows us? Top 8 per category by share. "< 1%" values have no number and are left out. Not date-filtered.
select category, value, percent::float8 as percent from (
  select category, value, percent, row_number() over (partition by category order by percent desc) as rn
  from li_organic_demographics where audience = 'followers' and percent is not null and category in ('Company','Industry','Seniority','Job title')
) t where rn <= 8 order by category, percent desc
