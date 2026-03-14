-- Campaign analysis runs table
-- Run this in Supabase SQL Editor.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS campaign_analysis_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  cta_link TEXT,
  phase TEXT NOT NULL DEFAULT 'complete',
  total_rounds INTEGER NOT NULL DEFAULT 0,
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_opened INTEGER NOT NULL DEFAULT 0,
  total_clicked INTEGER NOT NULL DEFAULT 0,
  open_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  click_rate NUMERIC(6,2) NOT NULL DEFAULT 0,
  metrics JSONB,
  round_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  improvements JSONB NOT NULL DEFAULT '[]'::jsonb,
  agent_categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  final_mails JSONB NOT NULL DEFAULT '[]'::jsonb,
  tools_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  terminal_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  twin_cards JSONB NOT NULL DEFAULT '[]'::jsonb,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS campaign_analysis_runs_created_at_idx
  ON campaign_analysis_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS campaign_analysis_runs_phase_idx
  ON campaign_analysis_runs (phase);

