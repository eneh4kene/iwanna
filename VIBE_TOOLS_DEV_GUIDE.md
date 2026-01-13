# @vibe Tools Developer Guide

This guide explains how the @vibe tools system works and how to create new tools.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [How It Works](#how-it-works)
3. [Creating a New Tool](#creating-a-new-tool)
4. [Tool Lifecycle](#tool-lifecycle)
5. [Testing Tools](#testing-tools)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

The @vibe tools system is a **modular, plugin-based architecture** that allows @vibe to perform utility actions in pod chats.

### Key Components

```
┌─────────────────────────────────────────────────────┐
│                  Pod Chat Interface                  │
│              (User types: @vibe ...)                │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│              chatService.ts                          │
│  • Detects @vibe mentions                           │
│  • Routes to vibeOrchestrator if tool query         │
│  • Falls back to conversational AI if not           │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│           vibeOrchestrator.ts                        │
│  • Parses intent using OpenAI function calling      │
│  • Selects appropriate tool from registry           │
│  • Executes tool with pod context                   │
│  • Logs execution to analytics database             │
│  • Returns formatted result to chat                 │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│            vibeToolRegistry.ts                       │
│  • Maintains list of registered tools               │
│  • Provides tool discovery                          │
│  • Runs health checks                               │
│  • Provides OpenAI function definitions             │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│                Individual Tools                      │
│  • PlaceFinderTool                                  │
│  • MeetingPointTool                                 │
│  • (Future tools...)                                │
└─────────────────────────────────────────────────────┘
```

### File Structure

```
backend/src/services/vibe/
├── vibeOrchestrator.ts       # Main coordinator
├── vibeToolRegistry.ts        # Tool registration & discovery
├── bootstrap.ts               # Initialization on server startup
├── types.ts                   # Shared type definitions
└── tools/
    ├── BaseTool.ts            # Abstract base class
    ├── PlaceFinderTool.ts     # Google Places search
    └── MeetingPointTool.ts    # Geographic centroid
```

---

## How It Works

### 1. User Sends @vibe Query

User in pod chat types: `@vibe where should we meet?`

### 2. chatService Detects Tool Query

```typescript
// chatService.ts
const toolKeywords = /\b(find|where|search|locate|meet|midpoint|middle|nearby|close|around)\b/i;
const looksLikeToolQuery = toolKeywords.test(userMessage);

if (looksLikeToolQuery) {
  // Route to orchestrator
  const toolResult = await vibeOrchestrator.processVibeQuery(userMessage, podContext);
}
```

### 3. Orchestrator Parses Intent with OpenAI

```typescript
// vibeOrchestrator.ts
const intent = await this.parseIntent(rawQuery, context);
// Returns: { toolName: "calculate_meeting_point", parameters: {}, confidence: 0.8 }
```

OpenAI GPT-4o-mini looks at:
- User query
- Available tool function definitions
- Returns which tool to use + parameters

### 4. Tool is Selected and Executed

```typescript
const tool = vibeToolRegistry.getTool(intent.toolName);
const result = await tool.execute({
  parameters: intent.parameters,
  context: podContext,
  rawQuery
});
```

### 5. Result Returned to Chat

```typescript
// chatService.ts saves message to database
await query(
  `INSERT INTO messages (pod_id, sender_id, content, message_type, metadata)
   VALUES ($1, $2, $3, 'ai_action', $4)`,
  [podId, null, toolResult.message, JSON.stringify(toolResult)]
);
```

### 6. Analytics Logged

```typescript
// Automatically logged to vibe_tool_calls table
INSERT INTO vibe_tool_calls (
  pod_id, user_id, tool_name, intent, parameters,
  result, success, execution_time_ms
) VALUES (...);
```

---

## Creating a New Tool

Let's create a **WeatherTool** as an example.

### Step 1: Create Tool File

Create `backend/src/services/vibe/tools/WeatherTool.ts`:

```typescript
import { BaseTool } from './BaseTool';
import {
  ToolParams,
  ToolResult,
  OpenAIFunctionDefinition,
  ToolError,
  ToolErrorType,
  ActionButton,
} from '../types';

export class WeatherTool extends BaseTool {
  readonly name = 'check_weather';
  readonly description = 'Get current weather conditions for the pod location. Use when users ask about weather, temperature, or conditions.';
  readonly version = '1.0.0';

  getFunctionDefinition(): OpenAIFunctionDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          // Optional parameters here
        },
        required: [],
      },
    };
  }

  override async isAvailable(): Promise<boolean> {
    // Check if weather API key is configured
    const apiKey = process.env.WEATHER_API_KEY;
    return !!apiKey;
  }

  override getRateLimit(): { maxCalls: number; windowMs: number } {
    return {
      maxCalls: 10, // 10 calls
      windowMs: 10 * 60 * 1000, // per 10 minutes
    };
  }

  protected async executeInternal(params: ToolParams): Promise<ToolResult> {
    const { location } = params.context;

    try {
      // Call weather API
      const weather = await this.fetchWeather(location);

      // Format message
      const message = `current weather: ${weather.temp}°F, ${weather.condition}`;

      // Create action buttons
      const actionButtons: ActionButton[] = [
        {
          id: 'view_forecast',
          label: 'View Forecast',
          icon: 'cloud-outline',
          action: 'custom',
          payload: { action: 'show_forecast', data: weather },
        },
      ];

      return this.createSuccessResult(message, { weather }, actionButtons);
    } catch (error) {
      throw new ToolError(
        ToolErrorType.API_ERROR,
        'Failed to fetch weather data',
        this.name,
        { error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  private async fetchWeather(location: { latitude: number; longitude: number }) {
    // Implement weather API call here
    // This is just a placeholder
    return {
      temp: 72,
      condition: 'sunny',
      humidity: 60,
    };
  }
}
```

### Step 2: Register Tool on Startup

Edit `backend/src/services/vibe/bootstrap.ts`:

```typescript
import { WeatherTool } from './tools/WeatherTool'; // Add import

export async function initializeVibeTools(): Promise<void> {
  try {
    logger.info('[VibeTools] Initializing @vibe tools system...');

    const placeFinderTool = new PlaceFinderTool();
    const meetingPointTool = new MeetingPointTool();
    const weatherTool = new WeatherTool(); // Add this

    vibeToolRegistry.register(placeFinderTool);
    vibeToolRegistry.register(meetingPointTool);
    vibeToolRegistry.register(weatherTool); // Add this

    // ... rest of initialization
  }
}
```

### Step 3: Add Environment Configuration (if needed)

Edit `backend/.env`:

```bash
# Weather API (for @vibe check_weather tool)
WEATHER_API_KEY=your-api-key-here
```

Edit `backend/src/config/index.ts`:

```typescript
export const weatherConfig = {
  apiKey: getEnv('WEATHER_API_KEY', ''),
};
```

### Step 4: Restart Backend

```bash
cd backend
npm run dev
```

You should see in logs:
```
[VibeTools] Registered tools: ["find_nearby_places", "calculate_meeting_point", "check_weather"]
```

### Step 5: Test Your Tool

Test in pod chat:
```
User: @vibe what's the weather like?
```

Or create a test script (see [Testing Tools](#testing-tools)).

---

## Tool Lifecycle

### 1. Registration (Server Startup)

```typescript
// bootstrap.ts
const weatherTool = new WeatherTool();
vibeToolRegistry.register(weatherTool);
```

Tool is added to registry and becomes available.

### 2. Health Check (Every 5 Minutes)

```typescript
// Automatic via vibeToolRegistry
const isHealthy = await weatherTool.isAvailable();
```

Tools are periodically checked to ensure external APIs are reachable.

### 3. Execution (On User Query)

```typescript
// Triggered by user @vibe query
const result = await weatherTool.execute({
  parameters: { /* parsed from query */ },
  context: { /* pod context */ },
  rawQuery: "@vibe what's the weather?"
});
```

### 4. Logging (After Execution)

```typescript
// Automatically logged to database
INSERT INTO vibe_tool_calls (pod_id, user_id, tool_name, result, success, execution_time_ms)
```

### 5. Cleanup (Server Shutdown)

```typescript
// bootstrap.ts
vibeToolRegistry.stopHealthChecks();
```

Health check intervals are cleared.

---

## Testing Tools

### Option 1: Manual Testing in Mobile App

1. Start backend: `cd backend && npm run dev`
2. Start mobile: `cd mobile && npm start`
3. Create a pod with other users
4. Send @vibe query in pod chat
5. Observe @vibe's response

### Option 2: Automated Test Script

Create `backend/test-my-tool.js`:

```javascript
const { vibeOrchestrator } = require('./dist/services/vibe/vibeOrchestrator');
const { vibeToolRegistry } = require('./dist/services/vibe/vibeToolRegistry');
const { WeatherTool } = require('./dist/services/vibe/tools/WeatherTool');

// Register tool
const weatherTool = new WeatherTool();
vibeToolRegistry.register(weatherTool);

// Mock context
const testContext = {
  podId: '00000000-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000002',
  location: {
    latitude: 37.7749,
    longitude: -122.4194,
  },
  members: [
    {
      userId: '00000000-0000-0000-0000-000000000002',
      username: 'TestUser1',
      location: { latitude: 37.7749, longitude: -122.4194 },
    },
  ],
  activity: 'coffee',
  category: 'food_social',
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000),
};

async function testWeatherTool() {
  console.log('🧪 Testing WeatherTool...\n');

  const result = await vibeOrchestrator.processVibeQuery(
    "@vibe what's the weather?",
    testContext
  );

  console.log('Success:', result.success);
  console.log('Message:', result.message);
  console.log('Data:', result.data);
  console.log('Action Buttons:', result.actionButtons);
  console.log('Metadata:', result.metadata);
}

testWeatherTool().catch(console.error);
```

Run:
```bash
cd backend
npm run build
node test-my-tool.js
```

### Option 3: Check Analytics

Query database:
```sql
SELECT
  tool_name,
  COUNT(*) as total_calls,
  AVG(execution_time_ms) as avg_time,
  COUNT(*) FILTER (WHERE success = true) as successes,
  COUNT(*) FILTER (WHERE success = false) as failures
FROM vibe_tool_calls
WHERE tool_name = 'check_weather'
GROUP BY tool_name;
```

Or use the view:
```sql
SELECT * FROM vibe_tool_stats WHERE tool_name = 'check_weather';
```

---

## Best Practices

### 1. Tool Naming

- Use **verb_noun** format: `find_nearby_places`, `calculate_meeting_point`, `check_weather`
- Be specific and descriptive
- Avoid generic names like `search` or `get_info`

### 2. Descriptions for OpenAI

Write clear descriptions that help OpenAI choose the right tool:

**Good:**
```typescript
description: 'Get current weather conditions for the pod location. Use when users ask about weather, temperature, or conditions.'
```

**Bad:**
```typescript
description: 'Weather tool'
```

### 3. Parameter Validation

Always validate parameters in `validateParameters()`:

```typescript
override validateParameters(parameters: Record<string, any>): void {
  if (!parameters['query'] || typeof parameters['query'] !== 'string') {
    throw new Error('query is required and must be a string');
  }

  if (parameters['radius']) {
    const radius = Number(parameters['radius']);
    if (isNaN(radius) || radius < 0 || radius > 10000) {
      throw new Error('radius must be between 0 and 10000');
    }
  }
}
```

### 4. Error Handling

Use `ToolError` for known error types:

```typescript
if (!apiKey) {
  throw new ToolError(
    ToolErrorType.NOT_AVAILABLE,
    'Weather API key not configured',
    this.name
  );
}
```

Available error types:
- `VALIDATION_ERROR` - Invalid parameters
- `API_ERROR` - External API failure
- `RATE_LIMIT_ERROR` - Rate limit exceeded
- `NOT_AVAILABLE` - Service unavailable (missing API key, etc.)
- `TIMEOUT` - Request timed out
- `EXECUTION_ERROR` - Unknown error

### 5. Caching

For expensive API calls, implement caching:

```typescript
private async getCachedResult(key: string): Promise<ToolResult | null> {
  try {
    const redis = getRedis();
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    this.warn('Failed to get cached result', { error, key });
    return null;
  }
}

private async cacheResult(key: string, result: ToolResult, ttl: number): Promise<void> {
  try {
    const redis = getRedis();
    await redis.setex(key, ttl, JSON.stringify(result));
  } catch (error) {
    this.warn('Failed to cache result', { error, key });
  }
}
```

Example cache key:
```typescript
const cacheKey = `weather:${location.latitude.toFixed(2)}:${location.longitude.toFixed(2)}`;
```

### 6. Rate Limiting

Set appropriate rate limits based on:
- External API rate limits
- Cost per request
- Expected usage frequency

```typescript
override getRateLimit(): { maxCalls: number; windowMs: number } {
  return {
    maxCalls: 5,               // 5 calls
    windowMs: 10 * 60 * 1000, // per 10 minutes
  };
}
```

### 7. Action Buttons

Provide actionable next steps:

```typescript
const actionButtons: ActionButton[] = [
  {
    id: 'show_on_map',
    label: 'Show on Map',
    icon: 'map-outline', // Ionicons name
    action: 'open_map',  // Built-in action
    payload: {
      url: 'https://maps.google.com/...',
      location: { latitude: 37.7749, longitude: -122.4194 }
    },
  },
  {
    id: 'custom_action',
    label: 'View Details',
    icon: 'information-circle-outline',
    action: 'custom', // Mobile app handles
    payload: {
      action: 'show_weather_details',
      data: weatherData
    },
  },
];
```

Built-in actions:
- `open_map` - Opens location in maps app
- `send_pin` - Sends location pin to chat
- `custom` - Mobile app handles via payload

### 8. Message Formatting

Follow @vibe's voice:
- lowercase
- max 2 sentences
- conversational, not robotic
- 1 emoji max (if appropriate)

**Good:**
```typescript
const message = `found 3 coffee spots nearby ☕`;
```

**Bad:**
```typescript
const message = `The system has identified three (3) coffee establishments in your vicinity.`;
```

### 9. Logging

Use built-in logging helpers:

```typescript
this.log('Processing weather request', { location });
this.warn('API response incomplete', { missingFields });
this.error('Failed to parse weather data', { error });
```

### 10. Availability Checks

Implement `isAvailable()` to check dependencies:

```typescript
override async isAvailable(): Promise<boolean> {
  // Check API key exists
  if (!process.env.WEATHER_API_KEY) {
    return false;
  }

  // Optionally: ping API to verify it's reachable
  try {
    await this.pingWeatherAPI();
    return true;
  } catch {
    return false;
  }
}
```

---

## Troubleshooting

### Tool Not Being Selected

**Symptom:** User sends @vibe query but orchestrator returns "i'm not sure how to help with that yet"

**Possible Causes:**
1. Tool not registered in `bootstrap.ts`
2. Tool description unclear for OpenAI
3. User query doesn't match tool's purpose
4. Tool marked as unavailable (`isAvailable()` returns false)

**Debug:**
```typescript
// Check registered tools
console.log(vibeToolRegistry.getAllTools().map(t => t.name));

// Check function definitions sent to OpenAI
console.log(vibeToolRegistry.getFunctionDefinitions());
```

### Tool Execution Failing

**Symptom:** Tool is selected but returns error

**Possible Causes:**
1. Parameter validation failing
2. External API error
3. Missing environment variables
4. Rate limit exceeded

**Debug:**
```bash
# Check backend logs
tail -f /Users/kene_eneh/iwanna/backend.log | grep -i error

# Check tool execution logs
SELECT * FROM vibe_tool_calls
WHERE tool_name = 'your_tool_name'
ORDER BY created_at DESC
LIMIT 10;
```

### Parameters Not Parsing Correctly

**Symptom:** OpenAI extracts wrong parameters or missing parameters

**Possible Causes:**
1. Parameter schema unclear
2. Parameter descriptions incomplete
3. OpenAI model not understanding query

**Fix:**
Improve parameter descriptions:

```typescript
getFunctionDefinition(): OpenAIFunctionDefinition {
  return {
    name: this.name,
    description: this.description,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What to search for (e.g., "coffee", "park", "restaurant"). Be specific about the type of place.', // More detail
        },
        radius_meters: {
          type: 'number',
          description: 'Search radius in meters. Default: 1000 (1km). Max: 5000 (5km). Use larger radius for rural areas.', // Context
        },
      },
      required: ['query'], // Mark required fields
    },
  };
}
```

### OpenAI Not Available

**Symptom:** `parseIntent()` throws error about OpenAI

**Possible Causes:**
1. `OPENAI_API_KEY` not set
2. OpenAI API quota exceeded
3. Network connectivity issue

**Fix:**
```bash
# Check .env
cat backend/.env | grep OPENAI_API_KEY

# Test OpenAI connectivity
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Database Logging Failing

**Symptom:** Tool executes but no records in `vibe_tool_calls`

**Possible Causes:**
1. Database not connected
2. `vibe_tool_calls` table doesn't exist
3. Missing podId or userId in context

**Fix:**
```bash
# Check if table exists
docker-compose exec postgres psql -U iwanna -d iwanna_db -c "\dt vibe_tool_calls"

# Check recent errors
tail -f backend.log | grep "Failed to log tool execution"
```

### Rate Limit Issues

**Symptom:** Tool returns "slow down" error

**Possible Causes:**
1. User exceeding rate limit
2. Rate limit too strict for use case

**Fix:**
```typescript
// Increase rate limit in tool
override getRateLimit(): { maxCalls: number; windowMs: number } {
  return {
    maxCalls: 20,              // Increased from 10
    windowMs: 10 * 60 * 1000, // Same window
  };
}
```

Or check who's hitting limits:
```sql
SELECT
  user_id,
  tool_name,
  COUNT(*) as calls_in_last_10min
FROM vibe_tool_calls
WHERE created_at > NOW() - INTERVAL '10 minutes'
GROUP BY user_id, tool_name
HAVING COUNT(*) > 5
ORDER BY calls_in_last_10min DESC;
```

---

## Additional Resources

- **See existing tools:** `backend/src/services/vibe/tools/`
- **Test script example:** `backend/test-vibe-tools.js`
- **Architecture diagram:** `VIBE_TOOLS_ROADMAP.md`
- **Type definitions:** `backend/src/services/vibe/types.ts`
- **OpenAI Function Calling Docs:** https://platform.openai.com/docs/guides/function-calling

---

## Questions?

If you encounter issues or have questions:

1. Check existing tools for examples
2. Review logs: `tail -f backend/log`
3. Query analytics: `SELECT * FROM vibe_tool_stats;`
4. Consult this guide

Happy building! 🚀
