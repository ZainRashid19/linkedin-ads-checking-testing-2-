-- Question: how do our cold email (ManyReach) campaigns do? Reached, opened (tracking is off, so 0), total replies, positive replies (null until entered). Typed from ManyReach report pages. Not date-filtered.
select campaign, reached, opened, replied, positive_replies, opportunities_usd::float as opportunities_usd, first_day::text, last_day::text
from manyreach_campaigns order by reached desc
