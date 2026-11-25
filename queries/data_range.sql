-- First and last day we have organic LinkedIn data for. Sets the default date range.
select min(day)::text as min_day, max(day)::text as max_day from li_organic_daily
