# @vibe: The AI Social Facilitator

**Core Insight:** @vibe isn't a chatbot - she's a **social lubricant** and **conversation catalyst**. Her job is to reduce the awkwardness of strangers connecting and help them get to the actual hangout faster.

---

## Key Principles for @vibe's Interactions

### 1. **Timing Over Frequency**
- She should be **invisible when things are flowing**, **present when things stall**
- Think of her like a great host at a party - only steps in when someone looks uncomfortable

### 2. **Actionable, Not Conversational**
- Don't say: "Hey everyone! How's it going?"
- DO say: "quick intros? drop your vibe + what brought you here"
- Every message should have a **clear next action**

### 3. **Read the Room**
- If conversation is flowing → Silent observer
- If 2+ min silence → Gentle prompt
- If stuck on decisions → Offer structured help
- If plan locked in → Confirmation + reminder mode

---

## @vibe's Interaction Flow (Pod Lifecycle)

### **Stage 1: Pod Formation (0-2 minutes)**
**Mental state:** High anxiety, "who are these people?"

**@vibe's role:** Ice breaker

```
[30 seconds after pod forms, if no messages]

@vibe: "hey! quick intros? who are you + what brought you here today?"

[If someone already said hi first]
@vibe: *stays silent, lets humans take lead*
```

**UX Pattern:**
- Avatar appears with subtle fade-in
- Message has soft purple background (visually distinct from human messages)
- No prompt if humans are already talking

---

### **Stage 2: Breaking the Ice (2-5 minutes)**
**Mental state:** Tentative sharing, feeling each other out

**@vibe's role:** Momentum builder

```
[If people introduced but now stuck]

@vibe: "so where are we thinking? anyone got a spot in mind?"

[Or if activity unclear]

@vibe: "quick vibe check - coffee, food, or just walking around?"
```

**UX Pattern:**
- Inline quick reply buttons: "coffee" | "food" | "walk" | "flexible"
- Each person's tap shows visually (like Instagram story reactions)
- Creates group consensus quickly

---

### **Stage 3: Decision Making (5-20 minutes)**
**Mental state:** "Let's figure this out but nobody wants to be pushy"

**@vibe's role:** Decision facilitator

```
[If back-and-forth on location for 5+ messages]

@vibe: "seeing lots of flexibility - want me to find a midpoint spot?"

[Inline buttons: "yes please" | "we got it"]

[If yes]

@vibe: "based on where you all are, here are 3 spots:"
→ Coffee Lab (0.2mi from center)
→ Peet's on Main (0.3mi from center)
→ Blue Bottle (0.5mi from center)

[Each spot is tappable, opens map]
```

**UX Pattern:**
- **Location-aware suggestions** using pod members' locations
- **Visual cards** for places (not just text)
- **One-tap actions** - tap place → sends "I'm down for Coffee Lab!" in chat

---

### **Stage 4: Plan Lock-In (When consensus emerging)**
**Mental state:** "Are we actually doing this?"

**@vibe's role:** Confirmation + clarity

```
[Detects agreement pattern]

@vibe: "locking it in: coffee at Blue Bottle, 3:15pm?"

[Inline reactions: ✓ | ✗ | running late]

[When all check]

@vibe: "confirmed! see you there ✨"
→ [Plan pinned to top of chat]
→ [Calendar add button]
```

**UX Pattern:**
- **Visual confirmation** - Message changes style when plan confirmed (green border?)
- **Pinned plan** at top of chat (always visible)
- **Quick actions:** Share location, Add to calendar, Running late

---

### **Stage 5: Pre-Meetup (15 min before)**
**Mental state:** "Oh shit it's almost time"

**@vibe's role:** Reminder + logistics

```
@vibe: "heading out soon? Blue Bottle in 15 min"

[Inline buttons:]
→ Share my location
→ Running 10 min late
→ Need to reschedule
```

**UX Pattern:**
- **Push notification** + in-chat message
- **Location sharing** - One tap shares live location for 30 min
- **Status updates** visible to all (so others know if someone's late)

---

### **Stage 6: During Hangout (Silent Mode)**
**Mental state:** Actually hanging out IRL

**@vibe's role:** Disappear

```
[No messages during the hangout window]

[Only responds if explicitly @mentioned]
@vibe: "need something? i'm here but staying quiet 🤫"
```

**UX Pattern:**
- Chat still accessible but @vibe is silent
- Visual indicator: "Enjoy your hangout! 🌟"

---

### **Stage 7: Post-Hangout (After pod expires)**
**Mental state:** Reflecting on experience

**@vibe's role:** Feedback collector

```
[Triggers PostPodFeedbackScreen bottom sheet]

@vibe: "how'd it go? tap a vibe 👇"
[4 emoji reactions: 🔥 😊 😐 👎]
```

**UX Pattern:**
- Already implemented in PostPodFeedbackScreen
- One-tap feedback (no typing required)
- Optional note expansion

---

## Visual Design for @vibe Messages

**Distinct but not jarring:**
- Avatar: Small purple circle with "✨" icon
- Background: Subtle purple tint (10% opacity)
- Font: Slightly smaller than human messages (14px vs 16px)
- Style: Italic or different weight to differentiate
- Position: Always centered (not left/right like users)

**Example:**
```
┌─────────────────────────────────────┐
│  ✨ @vibe                            │
│  quick intros? drop your vibe +     │
│  what brought you here              │
│                                     │
│  [button] [button] [button]         │
└─────────────────────────────────────┘
```

---

## Engagement Mechanisms

### **1. Inline Actions (Core UX)**
Every @vibe message should have **tappable actions** embedded:
- Coffee | Food | Walk (activity voting)
- ✓ Confirmed | ✗ Can't make it (plan confirmation)
- Share location | Running late (logistics)
- Suggest something else (when stuck)

### **2. Visual Reactions**
When someone taps a button, show mini-avatar next to it:
```
Coffee ☕️  [Alice's avatar] [Bob's avatar]
Food 🍕   [Charlie's avatar]
```
Creates social proof + group momentum

### **3. Progress Indicators**
Show pod's progress toward plan:
```
Progress: Introductions ✓ | Location ⏳ | Time ⏳
```
Gamifies the planning process

### **4. Smart Silence**
@vibe tracks conversation health:
- **High engagement** (messages < 1 min apart) → Silent
- **Medium engagement** (1-3 min apart) → Observing
- **Low engagement** (3+ min apart) → Gentle prompt

---

## Personality & Voice

**Always:**
- Lowercase (except proper nouns)
- Max 2 sentences per message
- Active voice, present tense
- "we" not "you guys"
- 1 emoji max per message

**Never:**
- "I'm an AI assistant"
- "How can I help you?"
- Corporate language
- Apologizing
- Overexplaining

**Examples:**

✅ Good:
- "quick poll - coffee or food?"
- "locking it in: Blue Bottle at 3pm?"
- "anyone know this area? need recs"

❌ Bad:
- "Hello! I'm @vibe, your AI assistant here to help coordinate your meetup!"
- "I apologize for the confusion. Let me try to understand what you'd like to do."
- "Please let me know if you need any additional assistance with planning."

---

## Technical Implementation

**Files to modify:**
1. `backend/src/services/aiChatService.ts` - Already exists
2. `backend/src/controllers/chatController.ts` - Add @vibe trigger logic
3. `mobile/src/screens/PodDetailScreen.tsx` - Render @vibe messages differently

**Trigger System:**
```typescript
// Pseudocode for when @vibe speaks

if (podAge < 2min && messageCount === 0) {
  sendVibeMessage("ice-breaker");
}

if (timeSinceLastMessage > 2min && !planConfirmed) {
  sendVibeMessage("momentum-builder");
}

if (indecisionDetected() && messageCount > 5) {
  sendVibeMessage("decision-helper");
}

if (planConfirmed && !reminderSent && timeUntilMeetup === 15min) {
  sendVibeMessage("pre-meetup-reminder");
}
```

**Rate Limiting:**
- Min 2 minutes between @vibe messages (configurable)
- Max 5 messages per person in pod (scales with pod size)
  - Example: 3-person pod = 15 total @vibe messages max
  - Example: 5-person pod = 25 total @vibe messages max
- Premium users (Tier 3): unlimited @vibe messages
- Exponential backoff if users ignore prompts

---

## Why This Drives Engagement & Retention

### **Reduces Anxiety**
- New users don't have to figure out "what do I say first?"
- @vibe gives clear next steps

### **Accelerates Connection**
- Gets people from "matched" to "IRL hangout" faster
- Less time wasted on logistics

### **Creates Memorable Moments**
- When @vibe helps a group nail plans smoothly, it feels magical
- "Wow, this app just WORKS"

### **Builds Trust**
- Consistent, helpful presence → Users trust the platform
- Like having a concierge for your social life

### **Encourages Repeat Usage**
- Good first experience → Come back for second pod
- @vibe remembers preferences → "Last time you did coffee, want similar?"

---

## Implementation Roadmap

### **Phase 1: Core Personality & Triggers**
- Write GPT-4 system prompts for @vibe
- Build trigger detection system
- Basic message sending (text only)

### **Phase 2: Visual Design**
- Custom @vibe message styling in chat
- Centered messages with purple tint
- ✨ avatar icon

### **Phase 3: Inline Actions**
- Add button support to chat messages
- Voting system (coffee/food/walk)
- Visual reaction aggregation

### **Phase 4: Smart Features**
- Location-based suggestions
- Plan pinning
- Calendar integration
- Pre-meetup reminders

### **Phase 5: Analytics & Learning**
- Track @vibe effectiveness
- A/B test different prompts
- Personalization based on user preferences
