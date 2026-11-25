-- Question: who sees our ads? Top 8 segments per dimension by impressions (LinkedIn only reports the top 25). Not date-filtered.
select dimension, segment, impressions, clicks from (
  select dimension, segment, impressions, clicks, row_number() over (partition by dimension order by impressions desc) as rn
  from li_audience where dimension in ('Company Name','Job Seniority','Company Industry','Job Function')
) t where rn <= 8 order by dimension, impressions desc
