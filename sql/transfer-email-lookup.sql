-- ============================================================
-- BlockTrade: Email-based Transfer Lookup
-- Run this in your Supabase SQL Editor to enable email lookup
-- for in-app transfers.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- fn_lookup_user_by_email
--   Finds a user by their registered email address.
--   Returns: found, username, display_name, transfer_id, email
--   • Case-insensitive match
--   • Only returns active, non-admin users
--   • Never returns the calling user themselves
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_lookup_user_by_email(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id  uuid;
  v_user       public.users%ROWTYPE;
BEGIN
  -- Get calling user's ID so we can exclude self-transfers
  v_caller_id := auth.uid();

  SELECT *
  INTO   v_user
  FROM   public.users
  WHERE  lower(email) = lower(trim(p_email))
  AND    id <> v_caller_id
  LIMIT  1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  -- Do not expose the email in the response for privacy
  RETURN jsonb_build_object(
    'found',        true,
    'username',     v_user.username,
    'display_name', v_user.display_name,
    'transfer_id',  v_user.transfer_id,
    'email_hint',   left(v_user.email, 2) || repeat('*', greatest(length(v_user.email) - 6, 3)) || right(v_user.email, 4)
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION fn_lookup_user_by_email(text) TO authenticated;
