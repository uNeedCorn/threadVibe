-- Add last_active_at column to profiles table for activity tracking
-- This column is updated by the frontend when users are active (throttled to 10 min intervals)

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

-- Add index for efficient sorting in admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_last_active_at ON profiles(last_active_at);

COMMENT ON COLUMN profiles.last_active_at IS 'Last time the user was active in the app (updated every 10 minutes)';
