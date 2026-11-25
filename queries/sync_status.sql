-- When was each automatically synced source last refreshed? Only successful runs count.
select source, max(ran_at)::text as ran_at from sync_log where ok group by source
