# @vibe Tools System - Development Roadmap

**Status**: Phase 1F In Progress
**Started**: January 2026
**Goal**: Transform @vibe from conversational AI into an actionable social concierge

---

## 🎯 Vision

> **@vibe doesn't talk much. But when it does, it gets people moving.**

@vibe will evolve from a passive chat participant into an **active utility layer** that helps pods coordinate spontaneous meetups faster and more efficiently. Tools are **user-invoked** (via `@vibe [query]`), never intrusive, and always transparent.

---

## 📐 Architecture Principles

### 1. **Modular & Extensible**
- Each tool is self-contained and independent
- Tools can be added/removed without affecting others
- Registry-based discovery system
- Version tracking for backwards compatibility

### 2. **Consent-First**
- Tools never activate automatically
- Users must explicitly `@mention` @vibe
- Clear permissions for any external API calls
- Full transparency in tool actions

### 3. **Analytics-Driven**
- Track tool usage, success rates, execution time
- Data informs which tools to prioritize next
- A/B testing capability for tool variations

### 4. **Graceful Degradation**
- If API fails, fallback to cached data or helpful error
- Rate limiting prevents abuse and cost overruns
- Tools work independently (one failure doesn't break others)

---

## 🗺️ Phase 1F: MVP Tool System (Current)

**Timeline**: 2 weeks
**Status**: 🟡 In Progress

### Objectives
Build foundational tool architecture with 2 high-value tools to validate the system.

### Deliverables

#### 1. **Core Architecture** ✅
**Files**:
- `backend/src/services/vibe/vibeOrchestrator.ts` - Main coordinator
- `backend/src/services/vibe/vibeToolRegistry.ts` - Tool registration
- `backend/src/services/vibe/types.ts` - Shared interfaces
- `backend/src/services/vibe/tools/BaseTool.ts` - Abstract base class

**Capabilities**:
- Tool discovery and registration
- OpenAI function calling integration
- Standardized error handling
- Logging and analytics hooks

#### 2. **Place Finder Tool** 🔨
**Command**: `@vibe find [query] nearby`
**Examples**:
- `@vibe find coffee nearby`
- `@vibe find sauna`
- `@vibe where can we play basketball?`

**Implementation**:
- Google Places API integration
- Search radius: 1km default (configurable)
- Returns top 3 results with:
  - Name, address, rating, distance
  - Open/closed status
  - Price level
  - Google Maps link
- Caches results for 15 minutes

**Function Definition**:
```json
{
  "name": "find_nearby_places",
  "description": "Search for places near the pod's current location",
  "parameters": {
    "query": {
      "type": "string",
      "description": "What to search for (e.g., 'coffee', 'sauna', 'basketball court')"
    },
    "radius_meters": {
      "type": "number",
      "description": "Search radius in meters (default: 1000)"
    }
  }
}
```

#### 3. **Meeting Point Calculator Tool** 🔨
**Command**: `@vibe best place to meet?` or `@vibe where should we meet?`

**Implementation**:
- Calculate geographic centroid from all pod members' locations
- Compute distance from centroid to each member
- Find nearby landmarks or venues at the midpoint
- Return:
  - Suggested meeting point (address or landmark)
  - Distance per member ("Alex: 0.8 mi, Jordan: 1.2 mi")
  - Optional: venues at the midpoint if query includes category

**Function Definition**:
```json
{
  "name": "calculate_meeting_point",
  "description": "Find the fairest meeting point for all pod members based on their locations",
  "parameters": {
    "venue_type": {
      "type": "string",
      "description": "Optional: type of venue to find at the midpoint (e.g., 'cafe', 'park')"
    }
  }
}
```

#### 4. **Analytics Database** 📊
**Table**: `vibe_tool_calls`

**Schema**:
```sql
CREATE TABLE vibe_tool_calls (
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
```

**Metrics to Track**:
- Tool usage frequency
- Success/failure rates
- Average execution time
- Most common queries
- Tool usage by pod category

#### 5. **OpenAI Function Calling Integration** 🤖
**Flow**:
```
User: "@vibe find coffee nearby"
  ↓
chatService.ts detects @vibe mention
  ↓
aiChatService.ts sends to OpenAI with function definitions
  ↓
OpenAI returns: function_call: { name: "find_nearby_places", arguments: { query: "coffee" } }
  ↓
vibeOrchestrator.ts routes to PlaceFinderTool
  ↓
PlaceFinderTool.execute() calls Google Places API
  ↓
Returns formatted results to pod chat
```

### Success Criteria
- ✅ Users can invoke tools with `@vibe [natural language query]`
- ✅ Place Finder returns 3 relevant venues within 2 seconds
- ✅ Meeting Point shows fair midpoint with per-member distances
- ✅ 95%+ tool success rate (no crashes or API errors)
- ✅ All tool calls logged to analytics database
- ✅ System handles 100+ tool invocations per day without issues

### API Costs (Estimated)
- **Google Places Nearby Search**: $17 per 1,000 requests
- **OpenAI GPT-4 Function Calling**: ~$0.03 per tool invocation (1K input tokens)
- **Expected monthly cost** (1000 pods, 30% use tools): ~$20-30/month

---

## 🚀 Phase 2: Enhanced Tools & UX (Q1 2026)

**Timeline**: 3 weeks
**Status**: 📅 Planned

### New Tools

#### 1. **Poll/Voting Tool**
**Command**: `@vibe poll: [options]`
**Example**: `@vibe poll: Coffee vs Sauna vs Walk?`

**Implementation**:
- Lightweight in-chat voting (no forms)
- Auto-closes when clear winner emerges (>50% or all voted)
- Shows live vote counts
- 10-second interaction time

**Use Case**: Fast group decision-making when multiple options exist.

#### 2. **Timing/Scheduling Tool**
**Command**: `@vibe when can everyone meet?`

**Implementation**:
- Asks each member for availability
- Suggests optimal meetup time
- Sends readiness confirmation 10 minutes before
- Handles "I need 30 more minutes" requests

**Use Case**: Coordinate timing when members have different schedules.

#### 3. **Weather Context Tool**
**Command**: `@vibe what's the weather?` or auto-triggered with outdoor activities

**Implementation**:
- Fetches current weather at pod location
- Warns about rain/extreme heat
- Suggests indoor alternatives if weather is bad
- Only activates when relevant (outdoor pod categories)

**Use Case**: Proactive help for outdoor activities.

### Mobile UI Enhancements

#### Action Buttons
Add inline action buttons to tool results:

**Place Finder Results**:
```
@vibe: found 3 coffee spots:

[Card 1: Blue Bottle]
  📍 0.3 mi • 4.5⭐ • Open now
  [Show on Map] [Vote]

[Card 2: Philz Coffee]
  📍 0.5 mi • 4.7⭐ • Open now
  [Show on Map] [Vote]

[Pick for Me]
```

**Meeting Point Results**:
```
@vibe: best spot is Dolores Park

Distances:
• Alex: 0.8 mi (12 min walk)
• Jordan: 1.1 mi (15 min walk)
• Sam: 0.6 mi (9 min walk)

[Send Pin to Everyone] [Find Venue Here]
```

#### Map Previews
- Embedded map preview in chat
- Tap to expand to full Google Maps
- Show all members + meeting point
- Live ETA updates

### Success Criteria
- ✅ 3 new tools fully operational
- ✅ Action buttons reduce coordination time by 50%
- ✅ Map previews used in 80%+ of location-based queries
- ✅ Poll tool resolves group decisions in <2 minutes

---

## 🏢 Phase 3: Venue Partnerships & Bookings (Q2 2026)

**Timeline**: 6 weeks
**Status**: 📅 Planned

### Venue Partner Integration

#### Real-Time Availability
**Partners** sign up to:
- Share live availability via API
- Accept pod-based reservations
- Offer pod-specific deals

**Example Flow**:
```
User: "@vibe can we get a court at City Sports?"

@vibe:
  ✅ Court available at 6:30 PM (£20 for 1 hour)
  I can hold it for 10 minutes - proceed?

  [Yes, Hold It] [Find Other Options]
```

**Benefits for Venues**:
- Guaranteed group intent (2-5 people)
- Lower no-show risk
- Fill off-peak hours
- Direct marketing to hyper-local users

**Benefits for iwanna**:
- **Booking fee**: 10-15% of reservation value
- **Subscription model**: Venues pay $50-200/month for priority placement
- **Revenue share**: 5% commission on pod spends at partner venues

#### Booking Tool
**Command**: `@vibe can we book [venue]?`

**Implementation**:
- Check partner availability via API
- Hold reservation for 10 minutes (grace period)
- Confirm with pod consensus (majority vote)
- Send booking confirmation to venue + pod members
- Handle cancellations gracefully

**Safety Guardrails**:
- ❌ No auto-booking without explicit consent
- ❌ No payment without clear confirmation step
- ✅ Full transparency ("Contacting venue...")
- ✅ Group visibility (everyone sees booking status)

### AI-Assisted Outreach (Phase 3B)

**For non-partner venues**:
- @vibe sends standardized availability request via:
  - WhatsApp Business API
  - Email (scraped from Google Places)
  - Booking form submission (if available)
- Always transparent: "I'm sending a request on your behalf"
- Response appears in pod chat when received

**Legal/Compliance**:
- CAN-SPAM compliance (clear sender identity)
- GDPR consent (users opt-in)
- Rate limiting to prevent spam (max 3 requests/day)

### Success Criteria
- ✅ 50+ venue partners in launch city (San Francisco)
- ✅ 20%+ of pods use booking tool
- ✅ $1000+ monthly revenue from booking fees
- ✅ <5% booking cancellation rate

---

## 🔮 Phase 4: Advanced Intelligence (Q3 2026)

**Timeline**: 4 weeks
**Status**: 🔵 Future

### Smart Suggestions (Proactive)

#### Context-Aware Recommendations
@vibe learns from pod history to make **unsolicited but helpful** suggestions:

**Example**:
```
Pod: "play basketball" category
Time: 5:30 PM (sunset in 2 hours)
Weather: Clear skies

@vibe (proactive):
  "heads up - sun sets at 7:30. if you're meeting after 7,
   might want an indoor court? i can check availability."
```

**Triggers** (carefully designed to avoid spam):
- Weather changes affecting outdoor plans
- Time-sensitive opportunities (event starting soon, venue closing)
- Coordination stalls detected (15+ min with no decision)

#### Preference Learning (Pod-Level Only)
- Track what worked (venues pod visited and confirmed arrival)
- Suggest similar venues next time
- **Privacy**: Only within the current pod, never across pods
- **User Control**: Opt-out anytime ("@vibe stop suggesting venues")

### Multi-Pod Coordination
**Use Case**: Two separate pods want to merge for a larger activity.

**Example**:
```
Pod A: 3 people want to play volleyball (need 6+ players)
Pod B: 4 people want to play volleyball (nearby)

@vibe (to both pods):
  "Found another nearby pod looking for volleyball players.
   Want to join forces? Combined: 7 people, enough for a game."

   [Yes, Connect Us] [No Thanks]
```

### Success Criteria
- ✅ Proactive suggestions accepted 30%+ of time
- ✅ Multi-pod coordination used in 5%+ of sports pods
- ✅ Zero complaints about spam or over-suggesting

---

## 🛠️ Technical Debt & Improvements

### Ongoing Work

#### Performance Optimization
- Cache Google Places results for 15 minutes per location
- Redis caching for meeting point calculations
- Batch API requests where possible
- Lazy-load tool definitions (don't load all tools every request)

#### Security Hardening
- Rate limiting: Max 5 tool calls per pod per 10 minutes
- Input sanitization for all tool parameters
- API key rotation system
- Audit logging for all venue bookings

#### Reliability
- Graceful fallbacks for every API failure
- Circuit breakers for external APIs (stop calling if down)
- Health checks for all tools (disable if consistently failing)
- Retry logic with exponential backoff

#### Developer Experience
- CLI tool for testing tools locally
- Mock APIs for development
- Comprehensive unit tests for each tool
- Integration tests for full @vibe flows

---

## 📊 Success Metrics (Overall)

### Engagement Metrics
- **Tool Adoption Rate**: % of pods that use @vibe tools at least once
  - Target: 50%+ by end of Phase 2

- **Tools Per Pod**: Average number of tool invocations per active pod
  - Target: 2-3 tools per pod

- **Time to Decision**: Time from pod formation to meeting time locked in
  - Target: Reduce from 15 min average to <5 min

### Business Metrics
- **Show-Up Rate**: % of pods that confirm arrival at venue
  - Target: Increase from 60% to 80%+ (tools reduce ambiguity)

- **Revenue Per Tool**: Average revenue generated from venue bookings
  - Target: $2-5 per booking (Phase 3)

- **API Cost Efficiency**: Cost per successful tool invocation
  - Target: <$0.05 per tool call

### Quality Metrics
- **Tool Success Rate**: % of tool calls that complete without error
  - Target: 95%+

- **User Satisfaction**: Positive feedback on tool helpfulness
  - Target: 4.5/5 stars

- **Spam Complaints**: % of users who disable @vibe due to over-suggesting
  - Target: <1%

---

## 🚨 Risk Mitigation

### Identified Risks

#### 1. **API Cost Overruns**
**Risk**: Tools become popular, API costs spiral out of control.

**Mitigation**:
- Aggressive caching (15-min TTL for places, 5-min for weather)
- Rate limiting per pod (5 tool calls per 10 minutes)
- Budget alerts (notify if monthly cost exceeds $100)
- Fallback to free/cheaper APIs if primary fails

#### 2. **User Perception: "Too Pushy"**
**Risk**: @vibe suggests too much, users feel spammed.

**Mitigation**:
- **Consent-first**: Tools only activate via `@vibe` mention
- **No unsolicited suggestions** until Phase 4
- User control: "@vibe be quiet" disables proactive features
- A/B test suggestion frequency before rolling out

#### 3. **Venue Partnership Failures**
**Risk**: Venues don't see value, refuse to integrate or cancel.

**Mitigation**:
- Pilot with 5-10 friendly venues first
- Prove ROI: Track bookings, no-show rates, revenue
- Low barrier to entry (simple API, no upfront cost)
- Share success stories and data with prospects

#### 4. **Tool Complexity Creep**
**Risk**: Too many tools, users confused, @vibe feels bloated.

**Mitigation**:
- Launch with just 2 tools (Place Finder, Meeting Point)
- Add tools incrementally based on **data** (which are most requested?)
- Deprecate unused tools (if <5% usage after 2 months)
- Keep tool count under 8 total

---

## 📚 Documentation

### For Developers
- `VIBE_TOOLS_DEV_GUIDE.md` - How to add new tools
- `backend/src/services/vibe/README.md` - Architecture overview
- JSDoc comments on all tool interfaces

### For Users
- In-app help: "@vibe help" shows available tools
- Onboarding tooltip: "Try typing @vibe to get help"
- Blog post explaining the tools system

---

## 🎯 Next Steps (Immediate)

**Week 1** (Current):
- [x] Delete temporary MD files
- [x] Create this roadmap document
- [ ] Commit and push current state
- [ ] Create tool architecture (orchestrator, registry, base classes)
- [ ] Set up Google Places API integration

**Week 2**:
- [ ] Implement Place Finder tool
- [ ] Implement Meeting Point tool
- [ ] Add OpenAI function calling
- [ ] Create analytics database table
- [ ] Integration testing

**Week 3**:
- [ ] Mobile UI polish (if needed)
- [ ] Documentation (dev guide)
- [ ] Soft launch to 10 beta users
- [ ] Gather feedback, iterate

---

## 💡 Philosophy

@vibe's tools must feel like **having a helpful local friend** who:
- Knows the city
- Understands social dynamics
- Never pushes, only helps when asked
- Reduces friction, doesn't add it

If a tool doesn't pass this bar, we don't build it.

---

**Last Updated**: January 9, 2026
**Owner**: @vibe Team
**Status**: Phase 1F in progress
