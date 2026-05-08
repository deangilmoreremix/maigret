-- Create personalizer tables for VideoRemix.vip AI Creative Personalizer
-- Run this in Supabase SQL Editor

-- Profile scan results (public-only, optional)
CREATE TABLE IF NOT EXISTS profile_scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  target_name TEXT NOT NULL,
  target_handle TEXT,
  scan_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_score FLOAT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Personalization projects
CREATE TABLE IF NOT EXISTS personalization_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  app_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('cold-email', 'video-email', 'proposal', 'sales-page', 'thumbnail', 'content-campaign', 'agency-pitch', 'lead-summary')),
  target_name TEXT NOT NULL,
  target_company TEXT,
  manual_notes TEXT,
  scan_id UUID REFERENCES profile_scan_results(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'complete', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generated outputs
CREATE TABLE IF NOT EXISTS personalization_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES personalization_projects(id) ON DELETE CASCADE NOT NULL,
  output_type TEXT NOT NULL,
  content JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Prompt templates
CREATE TABLE IF NOT EXISTS personalizer_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  template_type TEXT CHECK (template_type IN ('system', 'user')) NOT NULL,
  content TEXT NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User settings
CREATE TABLE IF NOT EXISTS personalizer_settings (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  default_offer TEXT,
  default_goal TEXT,
  default_tone TEXT DEFAULT 'professional',
  default_cta TEXT,
  theme JSONB DEFAULT '{"primary": "#8B5CF6", "secondary": "#06B6D4"}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE profile_scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE personalization_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE personalization_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE personalizer_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own data)
CREATE POLICY "Users can manage own scan results" ON profile_scan_results
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own projects" ON personalization_projects
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own outputs" ON personalization_outputs
  FOR ALL USING (EXISTS (
    SELECT 1 FROM personalization_projects p WHERE p.id = project_id AND p.user_id = auth.uid()
  ));

CREATE POLICY "Users can manage own settings" ON personalizer_settings
  FOR ALL USING (auth.uid() = user_id);

-- Seed default prompt templates
INSERT INTO personalizer_templates (app_id, mode, template_type, content, is_default) VALUES
('videoremix-vip', 'cold-email', 'system', 'You are a professional email writer for VideoRemix.vip. Use the provided target information to personalize a cold email. Focus on business value, keep it non-creepy, use language like "your public presence suggests" when referencing profile data. Never use private/surveillance language.', TRUE),
('videoremix-vip', 'cold-email', 'user', 'Generate a cold email for {{target_name}} at {{target_company}}. Goal: {{goal}}. Offer: {{offer}}. Tone: {{tone}}. CTA: {{cta}}. Profile summary: {{profile_summary}}. Manual notes: {{manual_notes}}.', TRUE)
ON CONFLICT DO NOTHING;
