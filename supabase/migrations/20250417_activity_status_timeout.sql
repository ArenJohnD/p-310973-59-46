
-- Create a new function that includes a timeout parameter
CREATE OR REPLACE FUNCTION public.update_user_activity_status_with_timeout(
  user_id uuid,
  is_active boolean,
  inactivity_timeout integer DEFAULT 300
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the profile
  UPDATE public.profiles
  SET 
    is_active = update_user_activity_status_with_timeout.is_active,
    last_sign_in_at = CASE 
      WHEN update_user_activity_status_with_timeout.is_active THEN now()
      ELSE profiles.last_sign_in_at
    END
  WHERE id = update_user_activity_status_with_timeout.user_id;
  
  -- If we're setting to active, also create a background job to auto-expire
  -- the active status after inactivity_timeout seconds if not refreshed
  IF update_user_activity_status_with_timeout.is_active THEN
    -- Delete any existing expiry jobs for this user to avoid duplicates
    DELETE FROM pg_catalog.pg_stat_activity 
    WHERE application_name = 'activity_timeout_' || user_id::text;
    
    -- The timeout feature would use a scheduled task or trigger
    -- In an actual implementation, this would set up a pg_cron job or similar
    -- For this demo, we'll rely on the manual refreshes and client-side timeout handling
  END IF;
  
  RETURN true;
END;
$$;

-- Grant execute permission to the function
GRANT EXECUTE ON FUNCTION public.update_user_activity_status_with_timeout TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_activity_status_with_timeout TO anon;
GRANT EXECUTE ON FUNCTION public.update_user_activity_status_with_timeout TO service_role;
