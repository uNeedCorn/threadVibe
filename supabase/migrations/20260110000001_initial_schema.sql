-- ============================================
-- ThreadsVibe Initial Schema
-- Migration: 00001_initial_schema.sql
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- WORKSPACES
-- ============================================

CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  deleted_at TIMESTAMPTZ,
  deletion_confirmed_by JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workspaces_created_by ON workspaces(created_by_user_id);
CREATE INDEX idx_workspaces_deleted_at ON workspaces(deleted_at) WHERE deleted_at IS NOT NULL;

-- ============================================
-- WORKSPACE MEMBERS
-- ============================================

CREATE TABLE workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  invited_by UUID REFERENCES auth.users(id),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE INDEX idx_members_user ON workspace_members(user_id);
CREATE INDEX idx_members_workspace ON workspace_members(workspace_id);

-- ============================================
-- WORKSPACE THREADS ACCOUNTS (Layer 3: Current)
-- ============================================

CREATE TABLE workspace_threads_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  threads_user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  name TEXT,
  biography TEXT,
  profile_pic_url TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  -- Layer 3: Current Insights
  current_followers_count INTEGER NOT NULL DEFAULT 0,
  current_profile_views INTEGER NOT NULL DEFAULT 0,
  current_likes_count_7d INTEGER NOT NULL DEFAULT 0,
  current_views_count_7d INTEGER NOT NULL DEFAULT 0,
  last_insights_sync_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, threads_user_id)
);

CREATE INDEX idx_threads_accounts_workspace ON workspace_threads_accounts(workspace_id);
CREATE INDEX idx_threads_accounts_active ON workspace_threads_accounts(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_threads_accounts_followers ON workspace_threads_accounts(current_followers_count DESC);

-- ============================================
-- WORKSPACE THREADS TOKENS
-- ============================================

CREATE TABLE workspace_threads_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_account_id UUID NOT NULL REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,
  authorized_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT TRUE,
  transfer_reminder_sent_at TIMESTAMPTZ,
  auto_revoke_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tokens_account ON workspace_threads_tokens(workspace_threads_account_id);
CREATE INDEX idx_tokens_authorized_by ON workspace_threads_tokens(authorized_by_user_id);
CREATE INDEX idx_tokens_expires ON workspace_threads_tokens(expires_at) WHERE revoked_at IS NULL;

-- ============================================
-- WORKSPACE THREADS POSTS (Layer 3: Current)
-- ============================================

CREATE TABLE workspace_threads_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_account_id UUID NOT NULL REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,
  threads_post_id TEXT NOT NULL,
  text TEXT,
  media_type TEXT,
  media_url TEXT,
  permalink TEXT,
  published_at TIMESTAMPTZ NOT NULL,

  -- Layer 3: Current metrics (最新成效)
  current_views INTEGER NOT NULL DEFAULT 0,
  current_likes INTEGER NOT NULL DEFAULT 0,
  current_replies INTEGER NOT NULL DEFAULT 0,
  current_reposts INTEGER NOT NULL DEFAULT 0,
  current_quotes INTEGER NOT NULL DEFAULT 0,
  current_shares INTEGER NOT NULL DEFAULT 0,
  virality_score NUMERIC(10,2) DEFAULT 0,
  last_metrics_sync_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_threads_account_id, threads_post_id)
);

CREATE INDEX idx_posts_account_published ON workspace_threads_posts(workspace_threads_account_id, published_at DESC);
CREATE INDEX idx_posts_threads_id ON workspace_threads_posts(threads_post_id);
CREATE INDEX idx_posts_virality ON workspace_threads_posts(virality_score DESC) WHERE virality_score > 0;

-- ============================================
-- WORKSPACE THREADS POST METRICS (Layer 1: Snapshot)
-- ============================================

CREATE TABLE workspace_threads_post_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_post_id UUID NOT NULL REFERENCES workspace_threads_posts(id) ON DELETE CASCADE,
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  reposts INTEGER NOT NULL DEFAULT 0,
  quotes INTEGER NOT NULL DEFAULT 0,
  shares INTEGER NOT NULL DEFAULT 0,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_metrics_post_captured ON workspace_threads_post_metrics(workspace_threads_post_id, captured_at DESC);
CREATE INDEX idx_metrics_captured ON workspace_threads_post_metrics(captured_at DESC);

-- ============================================
-- WORKSPACE THREADS POST METRICS DELTAS (Layer 2: Delta)
-- ============================================

CREATE TABLE workspace_threads_post_metrics_deltas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_post_id UUID NOT NULL REFERENCES workspace_threads_posts(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  views_delta INTEGER NOT NULL DEFAULT 0,
  likes_delta INTEGER NOT NULL DEFAULT 0,
  replies_delta INTEGER NOT NULL DEFAULT 0,
  reposts_delta INTEGER NOT NULL DEFAULT 0,
  quotes_delta INTEGER NOT NULL DEFAULT 0,
  shares_delta INTEGER NOT NULL DEFAULT 0,
  is_recalculated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_post_deltas_post_period ON workspace_threads_post_metrics_deltas(workspace_threads_post_id, period_end DESC);
CREATE INDEX idx_post_deltas_period_end ON workspace_threads_post_metrics_deltas(period_end DESC);

-- ============================================
-- WORKSPACE THREADS ACCOUNT INSIGHTS (Layer 1: Snapshot)
-- ============================================

CREATE TABLE workspace_threads_account_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_account_id UUID NOT NULL REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,
  followers_count INTEGER NOT NULL DEFAULT 0,
  profile_views INTEGER NOT NULL DEFAULT 0,
  likes_count_7d INTEGER NOT NULL DEFAULT 0,
  views_count_7d INTEGER NOT NULL DEFAULT 0,
  demographics JSONB,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_insights_account_captured ON workspace_threads_account_insights(workspace_threads_account_id, captured_at DESC);
CREATE INDEX idx_insights_captured ON workspace_threads_account_insights(captured_at DESC);

-- ============================================
-- WORKSPACE THREADS ACCOUNT INSIGHTS DELTAS (Layer 2: Delta)
-- ============================================

CREATE TABLE workspace_threads_account_insights_deltas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_account_id UUID NOT NULL REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  followers_delta INTEGER NOT NULL DEFAULT 0,
  profile_views_delta INTEGER NOT NULL DEFAULT 0,
  likes_count_7d_delta INTEGER NOT NULL DEFAULT 0,
  views_count_7d_delta INTEGER NOT NULL DEFAULT 0,
  is_recalculated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_account_deltas_account_period ON workspace_threads_account_insights_deltas(workspace_threads_account_id, period_end DESC);
CREATE INDEX idx_account_deltas_period_end ON workspace_threads_account_insights_deltas(period_end DESC);

-- ============================================
-- USER SUBSCRIPTIONS
-- ============================================

CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan_type TEXT NOT NULL DEFAULT 'free',
  limits JSONB NOT NULL DEFAULT '{
    "max_workspaces": 1,
    "max_accounts_per_workspace": 1,
    "max_members_per_workspace": 1,
    "sync_interval_minutes": 60,
    "data_retention_days": 30
  }',
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_subscriptions_user ON user_subscriptions(user_id);

-- ============================================
-- SYNC LOGS
-- ============================================

CREATE TABLE sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_account_id UUID NOT NULL REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB
);

CREATE INDEX idx_sync_logs_account ON sync_logs(workspace_threads_account_id);
CREATE INDEX idx_sync_logs_started ON sync_logs(started_at DESC);
CREATE INDEX idx_sync_logs_status ON sync_logs(status) WHERE status = 'failed';

-- ============================================
-- SYSTEM ADMINS
-- ============================================

CREATE TABLE system_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TOKEN TRANSFERS (for pending transfers)
-- ============================================

CREATE TABLE token_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_account_id UUID NOT NULL REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,
  initiated_by UUID NOT NULL REFERENCES auth.users(id),
  target_user_id UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transfers_account ON token_transfers(workspace_threads_account_id);
CREATE INDEX idx_transfers_target ON token_transfers(target_user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on all tables
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_threads_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_threads_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_threads_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_threads_post_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_threads_post_metrics_deltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_threads_account_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_threads_account_insights_deltas ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_transfers ENABLE ROW LEVEL SECURITY;

-- ============================================
-- WORKSPACES POLICIES
-- ============================================

CREATE POLICY "workspace_select" ON workspaces
FOR SELECT USING (
  id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND joined_at IS NOT NULL
  )
);

CREATE POLICY "workspace_insert" ON workspaces
FOR INSERT WITH CHECK (
  auth.uid() = created_by_user_id
);

CREATE POLICY "workspace_update" ON workspaces
FOR UPDATE USING (
  id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);

CREATE POLICY "workspace_delete" ON workspaces
FOR DELETE USING (
  id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);

-- ============================================
-- WORKSPACE MEMBERS POLICIES
-- ============================================

CREATE POLICY "members_select" ON workspace_members
FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members wm
    WHERE wm.user_id = auth.uid()
  )
);

CREATE POLICY "members_insert" ON workspace_members
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members wm
    WHERE wm.user_id = auth.uid() AND wm.role = 'owner'
  )
);

CREATE POLICY "members_update" ON workspace_members
FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members wm
    WHERE wm.user_id = auth.uid() AND wm.role = 'owner'
  )
);

CREATE POLICY "members_delete" ON workspace_members
FOR DELETE USING (
  user_id = auth.uid() OR
  workspace_id IN (
    SELECT workspace_id FROM workspace_members wm
    WHERE wm.user_id = auth.uid() AND wm.role = 'owner'
  )
);

-- ============================================
-- THREADS ACCOUNTS POLICIES
-- ============================================

CREATE POLICY "accounts_select" ON workspace_threads_accounts
FOR SELECT USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND joined_at IS NOT NULL
  )
);

CREATE POLICY "accounts_insert" ON workspace_threads_accounts
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
  )
);

CREATE POLICY "accounts_update" ON workspace_threads_accounts
FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
  )
);

-- ============================================
-- TOKENS POLICIES (Sensitive - Owner only)
-- ============================================

CREATE POLICY "tokens_select" ON workspace_threads_tokens
FOR SELECT USING (
  workspace_threads_account_id IN (
    SELECT wta.id FROM workspace_threads_accounts wta
    JOIN workspace_members wm ON wta.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid() AND wm.role = 'owner'
  )
);

CREATE POLICY "tokens_insert" ON workspace_threads_tokens
FOR INSERT WITH CHECK (
  authorized_by_user_id = auth.uid()
);

-- ============================================
-- POSTS POLICIES
-- ============================================

CREATE POLICY "posts_select" ON workspace_threads_posts
FOR SELECT USING (
  workspace_threads_account_id IN (
    SELECT wta.id FROM workspace_threads_accounts wta
    JOIN workspace_members wm ON wta.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid() AND wm.joined_at IS NOT NULL
  )
);

-- ============================================
-- POST METRICS POLICIES (Layer 1: Snapshot)
-- ============================================

CREATE POLICY "metrics_select" ON workspace_threads_post_metrics
FOR SELECT USING (
  workspace_threads_post_id IN (
    SELECT wtp.id FROM workspace_threads_posts wtp
    JOIN workspace_threads_accounts wta ON wtp.workspace_threads_account_id = wta.id
    JOIN workspace_members wm ON wta.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid() AND wm.joined_at IS NOT NULL
  )
);

-- ============================================
-- POST DELTAS POLICIES (Layer 2: Delta)
-- ============================================

CREATE POLICY "post_deltas_select" ON workspace_threads_post_metrics_deltas
FOR SELECT USING (
  workspace_threads_post_id IN (
    SELECT wtp.id FROM workspace_threads_posts wtp
    JOIN workspace_threads_accounts wta ON wtp.workspace_threads_account_id = wta.id
    JOIN workspace_members wm ON wta.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid() AND wm.joined_at IS NOT NULL
  )
);

-- ============================================
-- ACCOUNT INSIGHTS POLICIES (Layer 1: Snapshot)
-- ============================================

CREATE POLICY "insights_select" ON workspace_threads_account_insights
FOR SELECT USING (
  workspace_threads_account_id IN (
    SELECT wta.id FROM workspace_threads_accounts wta
    JOIN workspace_members wm ON wta.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid() AND wm.joined_at IS NOT NULL
  )
);

-- ============================================
-- ACCOUNT INSIGHTS DELTAS POLICIES (Layer 2: Delta)
-- ============================================

CREATE POLICY "account_deltas_select" ON workspace_threads_account_insights_deltas
FOR SELECT USING (
  workspace_threads_account_id IN (
    SELECT wta.id FROM workspace_threads_accounts wta
    JOIN workspace_members wm ON wta.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid() AND wm.joined_at IS NOT NULL
  )
);

-- ============================================
-- SUBSCRIPTIONS POLICIES
-- ============================================

CREATE POLICY "subscriptions_select" ON user_subscriptions
FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "subscriptions_insert" ON user_subscriptions
FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================
-- SYNC LOGS POLICIES
-- ============================================

CREATE POLICY "logs_select" ON sync_logs
FOR SELECT USING (
  workspace_threads_account_id IN (
    SELECT wta.id FROM workspace_threads_accounts wta
    JOIN workspace_members wm ON wta.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid() AND wm.role = 'owner'
  )
);

-- ============================================
-- SYSTEM ADMINS POLICIES
-- ============================================

CREATE POLICY "admins_select" ON system_admins
FOR SELECT USING (user_id = auth.uid());

-- ============================================
-- TOKEN TRANSFERS POLICIES
-- ============================================

CREATE POLICY "transfers_select" ON token_transfers
FOR SELECT USING (
  initiated_by = auth.uid() OR target_user_id = auth.uid()
);

CREATE POLICY "transfers_insert" ON token_transfers
FOR INSERT WITH CHECK (initiated_by = auth.uid());

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON workspace_threads_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON workspace_threads_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
