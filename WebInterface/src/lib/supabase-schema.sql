-- ═══════════════════════════════════════════════════════════════
-- SUPABASE POSTGRESQL SCHEMA — CampaignX AI Platform
-- ═══════════════════════════════════════════════════════════════
-- 
-- HOW TO USE:
-- 1. Open your Supabase project dashboard
-- 2. Go to: SQL Editor → New Query
-- 3. Paste this entire file and click "Run"
-- 4. All tables will be created with proper relationships
-- ═══════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;  -- For RAG semantic search

-- ─────────────────────────────────────────────────────────────
-- TABLE: teams (API registration)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_name VARCHAR(100) NOT NULL UNIQUE,
    team_email VARCHAR(255) NOT NULL UNIQUE,
    api_key VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TABLE: campaigns (main campaign records)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_campaign_id VARCHAR(255),  -- ID from CampaignX API
    name VARCHAR(255) NOT NULL,
    brief TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'draft',  -- draft, pending_approval, active, completed, paused
    subject VARCHAR(200),
    body TEXT,
    target_segment VARCHAR(100) DEFAULT 'all',
    total_customers INTEGER DEFAULT 0,
    send_time TIMESTAMPTZ,
    
    -- AI Parameters
    temperature DECIMAL(3,2) DEFAULT 0.7,
    use_emojis BOOLEAN DEFAULT true,
    tone VARCHAR(50) DEFAULT 'friendly',
    optimization_round INTEGER DEFAULT 1,
    
    -- Performance (populated after campaign runs)
    open_rate DECIMAL(5,2),
    click_rate DECIMAL(5,2),
    total_opened INTEGER,
    total_clicked INTEGER,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────
-- TABLE: campaign_variants (A/B/C test content)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_variants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    variant_label VARCHAR(10) NOT NULL,  -- A, B, C
    subject VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    tone VARCHAR(50),
    tags TEXT[],
    expected_open_rate VARCHAR(20),
    expected_click_rate VARCHAR(20),
    is_selected BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TABLE: customer_cohort (mirrored from CampaignX API)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customer_cohort (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    age INTEGER,
    gender VARCHAR(20),
    region VARCHAR(100),
    city VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',  -- active, inactive
    is_senior_citizen BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TABLE: campaign_reports (performance metrics per customer)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    external_campaign_id VARCHAR(255),
    customer_id VARCHAR(50),
    send_time TIMESTAMPTZ,
    email_opened BOOLEAN DEFAULT false,   -- EO field from API
    email_clicked BOOLEAN DEFAULT false,  -- EC field from API
    invokation_date DATE,
    invokation_time TIME,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TABLE: optimization_suggestions (AI-generated)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS optimization_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium',  -- high, medium, low
    expected_impact VARCHAR(100),
    reasoning TEXT,
    current_value TEXT,
    suggested_value TEXT,
    category VARCHAR(50),  -- timing, content, personalization, segmentation
    status VARCHAR(20) DEFAULT 'pending',  -- pending, approved, rejected
    agent_thoughts TEXT[],
    approved_by VARCHAR(255),
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TABLE: agent_traces
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_traces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    trace_id VARCHAR(255),
    agent_name VARCHAR(100),
    step_type VARCHAR(50),  -- thought, action, observation, retrieval
    message TEXT,
    input JSONB,
    output JSONB,
    tokens_used INTEGER,
    latency_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- TABLE: campaign_embeddings (for RAG with pgvector)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS campaign_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content TEXT NOT NULL,
    embedding vector(768),  -- 768-dimension embedding storage
    metadata JSONB,
    source VARCHAR(255),  -- e.g., "bfsi_best_practices", "historical_campaign"
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create vector similarity search index
CREATE INDEX IF NOT EXISTS campaign_embeddings_embedding_idx
ON campaign_embeddings
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- ─────────────────────────────────────────────────────────────
-- FUNCTION: RAG semantic search
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION match_documents(
    query_embedding vector(768),
    match_threshold FLOAT DEFAULT 0.78,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        ce.id,
        ce.content,
        ce.metadata,
        1 - (ce.embedding <=> query_embedding) AS similarity
    FROM campaign_embeddings ce
    WHERE 1 - (ce.embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- VIEWS: Analytics
-- ─────────────────────────────────────────────────────────────

-- Campaign performance summary view
CREATE OR REPLACE VIEW campaign_performance_summary AS
SELECT
    c.id,
    c.name,
    c.status,
    c.send_time,
    c.total_customers,
    c.open_rate,
    c.click_rate,
    COUNT(DISTINCT os.id) FILTER (WHERE os.status = 'pending') AS pending_optimizations,
    COUNT(DISTINCT os.id) FILTER (WHERE os.status = 'approved') AS approved_optimizations,
    c.optimization_round,
    c.created_at
FROM campaigns c
LEFT JOIN optimization_suggestions os ON os.campaign_id = c.id
GROUP BY c.id;

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS) - Enable for production
-- ─────────────────────────────────────────────────────────────
-- ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE campaign_variants ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE campaign_reports ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE optimization_suggestions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE agent_traces ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────
-- SAMPLE DATA (for testing)
-- ─────────────────────────────────────────────────────────────
INSERT INTO campaigns (name, brief, status, subject, body, target_segment, total_customers, open_rate, click_rate)
VALUES (
    'XDeposit Launch - Phase 1',
    'Run email campaign for launching XDeposit, a flagship term deposit product from SuperBFSI, that gives 1 percentage point higher returns than its competitors.',
    'completed',
    '🚀 XDeposit: 1% Higher Returns, Just For You',
    'Dear [Customer Name], We are excited to introduce XDeposit...',
    'all',
    5000,
    34.2,
    18.7
) ON CONFLICT DO NOTHING;
