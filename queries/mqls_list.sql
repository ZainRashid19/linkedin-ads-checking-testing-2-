-- Question: who are our MQLs, which existing relationships did we set aside, and who did we book meetings with? Also shows each company's LinkedIn engagement level when its name matches a company export exactly. Uses the highest level it has reached in any loaded export.
select m.section, m.when_label, m.name, m.title, m.company, m.channel, m.source, m.status, m.section_note, l.engagement_level as level
from mqls m
left join lateral (
  select engagement_level from li_companies c
  where lower(c.company) = lower(m.company)
  order by case engagement_level when 'Very High' then 1 when 'High' then 2 when 'Medium' then 3 when 'Low' then 4 else 5 end, c.snapshot_date desc limit 1
) l on true
order by m.position
