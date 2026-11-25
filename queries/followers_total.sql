-- New followers in the period.
select coalesce(sum(new_followers),0)::int as gained from li_organic_followers where day between :from and :to
