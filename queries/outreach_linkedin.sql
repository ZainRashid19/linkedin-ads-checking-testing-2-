-- Question: how do our LinkedIn (Dripify) outreach campaigns convert? Invites to accepted, messaged, replied. Whole period reported; not date-filtered.
select campaign, sum(invites_sent)::int as invites, sum(invites_accepted)::int as accepted, sum(messaged)::int as messaged,
  sum(leads_replied)::int as replied, min(period_start)::text as first_day, max(period_end)::text as last_day
from dripify_stats group by campaign order by coalesce(sum(invites_sent), 0) desc, coalesce(sum(messaged), 0) desc
