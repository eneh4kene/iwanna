-- Reset daily limits for all users
-- This resets wannas_today counter and sets rate_limit_reset_at to tomorrow

UPDATE users
SET 
  wannas_today = 0,
  rate_limit_reset_at = NOW() + INTERVAL '1 day'
WHERE wannas_today > 0 OR rate_limit_reset_at IS NOT NULL;

-- Log the reset
DO $$
BEGIN
  RAISE NOTICE 'Daily limits reset for all users at %', NOW();
END $$;

