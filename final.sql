-- WARNING: This script will DESTROY all existing data in these tables.
-- Run this in your Supabase SQL Editor to get a fresh start.

-- 1. DROP EXISTING TABLES IN REVERSE DEPENDENCY ORDER
DROP TABLE IF EXISTS public.agent_traces CASCADE;
DROP TABLE IF EXISTS public.optimization_suggestions CASCADE;
DROP TABLE IF EXISTS public.campaign_variants CASCADE;
DROP TABLE IF EXISTS public.campaigns CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.customer_cohort CASCADE;
DROP TABLE IF EXISTS public.teams CASCADE;
DROP TABLE IF EXISTS public.campaign_embeddings CASCADE;
DROP TABLE IF EXISTS public.campaign_reports CASCADE;

-- 2. CREATE Customers CRM Table
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id character varying NOT NULL UNIQUE,
  email character varying NOT NULL,
  full_name character varying,
  age integer,
  gender character varying,
  marital_status character varying,
  family_size integer,
  dependent_count integer,
  occupation character varying,
  occupation_type character varying,
  monthly_income integer,
  kyc_status character varying,
  city character varying,
  kids_in_household integer,
  app_installed character varying,
  existing_customer character varying,
  credit_score integer,
  social_media_active character varying,
  emails_sent integer DEFAULT 0,
  emails_opened integer DEFAULT 0,
  emails_clicked integer DEFAULT 0,
  topics_list text[] DEFAULT '{}'::text[],
  w1 numeric DEFAULT 0.5,
  w2 numeric DEFAULT 0.5,
  w3 numeric DEFAULT 0.5,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT customers_pkey PRIMARY KEY (id)
);

-- 3. CREATE Campaigns Table
CREATE TABLE public.campaigns (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  external_campaign_id character varying,
  name character varying NOT NULL,
  brief text NOT NULL,
  status character varying DEFAULT 'draft'::character varying,
  subject character varying,
  body text,
  target_segment character varying DEFAULT 'all'::character varying,
  total_customers integer DEFAULT 0,
  send_time timestamp with time zone,
  temperature numeric DEFAULT 0.7,
  use_emojis boolean DEFAULT true,
  tone character varying DEFAULT 'friendly'::character varying,
  optimization_round integer DEFAULT 1,
  open_rate numeric,
  click_rate numeric,
  total_opened integer,
  total_clicked integer,
  target_customer_ids text[] DEFAULT '{}'::text[],
  strategy_reasoning text,
  json_output jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  approved_by character varying,
  approved_at timestamp with time zone,
  CONSTRAINT campaigns_pkey PRIMARY KEY (id)
);

-- 4. CREATE Campaign Variants
CREATE TABLE public.campaign_variants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid,
  variant_label character varying NOT NULL,
  subject character varying NOT NULL,
  body text NOT NULL,
  tone character varying,
  tags text[],
  expected_open_rate character varying,
  expected_click_rate character varying,
  is_selected boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT campaign_variants_pkey PRIMARY KEY (id),
  CONSTRAINT campaign_variants_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);

-- 5. CREATE Optimization Suggestions
CREATE TABLE public.optimization_suggestions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid,
  title character varying NOT NULL,
  priority character varying DEFAULT 'medium'::character varying,
  expected_impact character varying,
  reasoning text,
  current_value text,
  suggested_value text,
  category character varying,
  status character varying DEFAULT 'pending'::character varying,
  agent_thoughts text[],
  approved_by character varying,
  approved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT optimization_suggestions_pkey PRIMARY KEY (id),
  CONSTRAINT optimization_suggestions_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);

-- 6. CREATE Agent Traces
CREATE TABLE public.agent_traces (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  campaign_id uuid,
  run_id character varying,
  agent_name character varying,
  input_payload jsonb,
  output_payload jsonb,
  status character varying,
  latency_ms integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT agent_traces_pkey PRIMARY KEY (id),
  CONSTRAINT agent_traces_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES public.campaigns(id)
);

-- 7. Add dummy tables that existed originally to maintain parity
CREATE TABLE public.customer_cohort (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id character varying NOT NULL UNIQUE,
  email character varying NOT NULL,
  name character varying,
  age integer,
  gender character varying,
  region character varying,
  city character varying,
  status character varying DEFAULT 'active'::character varying,
  is_senior_citizen boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT customer_cohort_pkey PRIMARY KEY (id)
);

CREATE TABLE public.teams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  team_name character varying NOT NULL UNIQUE,
  team_email character varying NOT NULL UNIQUE,
  api_key character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT teams_pkey PRIMARY KEY (id)
);

-- 8. Disable RLS
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_variants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.optimization_suggestions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_traces DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_cohort DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams DISABLE ROW LEVEL SECURITY;

-- 9. Refresh Cache
NOTIFY pgrst, 'reload schema';
