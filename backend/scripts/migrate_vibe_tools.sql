-- Migration: @vibe Tools System Analytics
-- Created: 2026-01-09
-- Purpose: Track tool usage, success rates, and performance metrics

-- Create vibe_tool_calls table for analytics
CREATE TABLE IF NOT EXISTS vibe_tool_calls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pod_id UUID NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),
  tool_name VARCHAR(100) NOT NULL,
  intent TEXT NOT NULL,
  parameters JSONB,
  result JSONB,
  success BOOLEAN NOT NULL,
  execution_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_vibe_tool_calls_pod ON vibe_tool_calls(pod_id);
CREATE INDEX IF NOT EXISTS idx_vibe_tool_calls_user ON vibe_tool_calls(user_id);
CREATE INDEX IF NOT EXISTS idx_vibe_tool_calls_tool ON vibe_tool_calls(tool_name);
CREATE INDEX IF NOT EXISTS idx_vibe_tool_calls_created ON vibe_tool_calls(created_at);
CREATE INDEX IF NOT EXISTS idx_vibe_tool_calls_success ON vibe_tool_calls(success);

-- Create composite index for analytics queries
CREATE INDEX IF NOT EXISTS idx_vibe_tool_calls_analytics
  ON vibe_tool_calls(tool_name, success, created_at);

-- Add comments for documentation
COMMENT ON TABLE vibe_tool_calls IS 'Analytics table tracking all @vibe tool invocations';
COMMENT ON COLUMN vibe_tool_calls.id IS 'Unique identifier for this tool call';
COMMENT ON COLUMN vibe_tool_calls.pod_id IS 'Pod where the tool was invoked';
COMMENT ON COLUMN vibe_tool_calls.user_id IS 'User who invoked the tool';
COMMENT ON COLUMN vibe_tool_calls.tool_name IS 'Name of the tool that was called (e.g., find_nearby_places)';
COMMENT ON COLUMN vibe_tool_calls.intent IS 'Original user query/intent';
COMMENT ON COLUMN vibe_tool_calls.parameters IS 'Parameters passed to the tool (JSON)';
COMMENT ON COLUMN vibe_tool_calls.result IS 'Tool execution result (JSON)';
COMMENT ON COLUMN vibe_tool_calls.success IS 'Whether the tool executed successfully';
COMMENT ON COLUMN vibe_tool_calls.execution_time_ms IS 'Time taken to execute the tool in milliseconds';
COMMENT ON COLUMN vibe_tool_calls.created_at IS 'When the tool was invoked';

-- Create view for tool usage statistics
CREATE OR REPLACE VIEW vibe_tool_stats AS
SELECT
  tool_name,
  COUNT(*) AS total_calls,
  COUNT(*) FILTER (WHERE success = true) AS successful_calls,
  COUNT(*) FILTER (WHERE success = false) AS failed_calls,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success = true) / COUNT(*), 2) AS success_rate,
  AVG(execution_time_ms) FILTER (WHERE success = true) AS avg_execution_time_ms,
  MAX(execution_time_ms) AS max_execution_time_ms,
  MIN(execution_time_ms) FILTER (WHERE execution_time_ms > 0) AS min_execution_time_ms,
  MAX(created_at) AS last_used_at
FROM vibe_tool_calls
GROUP BY tool_name
ORDER BY total_calls DESC;

COMMENT ON VIEW vibe_tool_stats IS 'Aggregated statistics for each @vibe tool';

-- Migration complete
SELECT 'vibe_tools migration completed successfully!' AS status;
