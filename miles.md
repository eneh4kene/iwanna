# Optimal Matching Radius for Iwanna 📍

## 🎯 **Recommended: 3-5 Miles (5-8 km)**

Based on urban mobility patterns and spontaneous meetup feasibility, here's the complete analysis:

---

## 📊 Radius Analysis

### **3 Miles (5 km)** - RECOMMENDED FOR MVP ⭐

**Pros:**
- ✅ 10-15 minute travel time (walk/bike/transit)
- ✅ Truly spontaneous ("right now" is possible)
- ✅ Same neighborhood feel (people share local context)
- ✅ Higher match quality (tighter geographic clustering)
- ✅ Better for dense urban areas

**Cons:**
- ⚠️ May be too restrictive in suburban areas
- ⚠️ Fewer potential matches in low-density areas

**Use Cases:**
- Manhattan, Downtown LA, Central London, SF
- "I wanna grab coffee in the next hour"
- Walking distance meetups

**Code Implementation:**
```typescript
const DEFAULT_RADIUS_MILES = 3;
const DEFAULT_RADIUS_METERS = DEFAULT_RADIUS_MILES * 1609.34; // 4,828 meters

// In matchingService.ts
async findNearbyWannas(wanna: Wanna) {
  const nearbyIds = await redis.georadius(
    'active_wannas',
    wanna.location.lng,
    wanna.location.lat,
    DEFAULT_RADIUS_METERS,
    'm',
    'ASC' // Closest first
  );
}
```

---

### **5 Miles (8 km)** - GOOD BALANCE

**Pros:**
- ✅ 15-25 minute travel time
- ✅ Still feasible for spontaneous meetups
- ✅ More matches in medium-density areas
- ✅ Works for suburbs and cities

**Cons:**
- ⚠️ Starts to feel less "neighborhood"
- ⚠️ May require transit/car in some areas

**Use Cases:**
- Suburban areas, smaller cities
- "I wanna do something this afternoon"
- Mix of walking/transit meetups

---

### **1 Mile (1.6 km)** - TOO RESTRICTIVE ❌

**Problems:**
- ❌ Too few matches except in dense cities
- ❌ Limits user base growth
- ❌ Kills viral potential

**Only Use If:**
- Hyper-local experiment (single neighborhood)
- Very dense area (Manhattan only)

---

### **10+ Miles (16+ km)** - TOO BROAD ❌

**Problems:**
- ❌ 30-60+ minute travel time
- ❌ Kills "spontaneous" feeling
- ❌ Not same neighborhood (no shared context)
- ❌ Becomes planning, not spontaneity

**Only Use If:**
- Rural areas (as fallback)
- Special events (e.g., "festival in nearby town")

---

## 🏙️ Context-Aware Radius (FUTURE ENHANCEMENT)

### **Dynamic Radius Based on Density:**

```typescript
async function calculateOptimalRadius(location: Location): Promise<number> {
  const density = await getPopulationDensity(location);
  
  if (density > 10000) {
    return 3; // Dense urban (NYC, Tokyo, London)
  } else if (density > 5000) {
    return 5; // Medium urban (most cities)
  } else if (density > 1000) {
    return 8; // Suburban
  } else {
    return 15; // Rural (rare, but accommodates)
  }
}
```

**Population Density Tiers:**
- **>10K/sq mi**: Manhattan, Central London → 3 miles
- **5-10K/sq mi**: Most cities → 5 miles
- **1-5K/sq mi**: Suburbs → 8 miles
- **<1K/sq mi**: Rural → 10-15 miles (fallback)

---

## 🚗 Travel Mode Considerations

### **Time-Based Distance (Better Metric for Future):**

Instead of fixed radius, calculate "20-minute travel time"

```typescript
// Using Google Distance Matrix API or Mapbox Isochrone
async function getReachableArea(location: Location, minutes: number) {
  // Returns polygon of reachable locations in X minutes
  // Accounts for: walking, biking, transit, traffic
  
  return mapboxClient.isochrone({
    profile: 'walking', // or 'cycling', 'driving'
    coordinates: [location.lng, location.lat],
    contours_minutes: [minutes],
  });
}
```

**Benefits:**
- ✅ Accounts for actual travel time
- ✅ Different modes (walk vs transit)
- ✅ Traffic-aware
- ✅ Geographic barriers (rivers, highways)

**Downsides:**
- ⚠️ API costs
- ⚠️ Complexity
- ⚠️ Overkill for MVP

**Save for Phase 3+**

---

## 📏 Recommended Implementation Strategy

### **Phase 1 (MVP): Fixed 3-Mile Radius**

```typescript
// constants/matching.ts
export const MATCHING_CONFIG = {
  DEFAULT_RADIUS_MILES: 3,
  DEFAULT_RADIUS_METERS: 3 * 1609.34, // 4,828m
  MIN_RADIUS_MILES: 1,
  MAX_RADIUS_MILES: 10,
};
```

**Why 3 miles:**
- Simple, predictable
- Works in most cities
- Truly spontaneous
- Easy to explain to users

---

### **Phase 2: User-Adjustable Radius**

```typescript
// User preferences
interface UserPreferences {
  matching_radius_miles: number; // Default: 3, Range: 1-10
  // ... other preferences
}

// In UI
<Slider
  label="How far are you willing to travel?"
  value={preferences.matching_radius_miles}
  min={1}
  max={10}
  step={1}
  suffix=" miles"
/>
```

**Let users control:**
- Some want hyper-local (1-2 miles)
- Others willing to travel (5-8 miles)
- Personal preference

---

### **Phase 3: Smart Dynamic Radius**

```typescript
async function getMatchingRadius(userId: string, location: Location): Promise<number> {
  // 1. Check user preference first
  const userPref = await getUserPreference(userId, 'matching_radius_miles');
  if (userPref) return userPref;
  
  // 2. Calculate based on area density
  const density = await getAreaDensity(location);
  const basedOnDensity = densityToRadius(density);
  
  // 3. Adjust based on time of day
  const hour = new Date().getHours();
  const timeMultiplier = hour >= 10 && hour <= 22 ? 1.0 : 1.3; // Wider at night
  
  // 4. Adjust based on current active wannas nearby
  const activeNearby = await countActiveWannasNearby(location, basedOnDensity);
  if (activeNearby < 3) {
    // Expand radius if too few matches
    return Math.min(basedOnDensity * 1.5, 10);
  }
  
  return Math.round(basedOnDensity * timeMultiplier);
}
```

**Smart adjustments:**
- ✅ Fewer people at night? Expand radius
- ✅ Suburban area? Wider automatically
- ✅ Dense city? Keep tight
- ✅ No matches? Gradually expand

---

## 📊 Real-World Examples

### **Urban Areas:**

| City | Recommended | Reasoning |
|------|-------------|-----------|
| Manhattan, NYC | 2-3 miles | Very dense, everything walkable |
| San Francisco | 3-4 miles | Dense but hilly, transit common |
| London (Zone 1-2) | 3-5 miles | Good transit, walkable neighborhoods |
| Los Angeles | 5-8 miles | Car culture, sprawl |
| Tokyo | 2-3 miles | Dense, excellent transit |

### **Suburban Areas:**

| Type | Recommended | Reasoning |
|------|-------------|-----------|
| Dense suburbs | 5 miles | Some transit, mostly car |
| Typical suburbs | 8 miles | Car required |
| Rural areas | 10-15 miles | Very limited density |

---

## 🎯 Data to Collect (for Future Optimization)

Track these metrics to refine radius:

```typescript
// Analytics events
track('wanna.created', {
  user_id,
  location,
  radius_used: 3,
  matches_found: 2,
  time_to_match: 45, // seconds
});

track('pod.formed', {
  pod_id,
  avg_distance_between_members: 2.3, // miles
  centroid_to_members_avg: 1.1, // miles
});

track('pod.completed', {
  pod_id,
  actual_meetup_location_distance: 1.8, // miles from centroid
});
```

**Key Questions:**
- What's the median distance users actually travel?
- At what distance does completion rate drop?
- Do users prefer closer or more matches?

**Optimize based on:**
```
Goal: Maximize (Match Rate × Completion Rate × User Satisfaction)
```

---

## 🧪 A/B Test Scenarios

### **Test 1: 3 vs 5 miles**

**Hypothesis:** 5 miles increases matches but decreases completion rate

**Groups:**
- A: 3-mile radius
- B: 5-mile radius

**Metrics:**
- Match rate (% of wannas matched within 10 minutes)
- Pod formation rate
- Completion rate
- User satisfaction (survey)

**Expected Results:**
- 5 miles: +40% match rate, -15% completion rate
- 3 miles: Lower matches, higher completion

**Decision:** Use 3 miles if completion rate is significantly better

---

### **Test 2: Fixed vs User-Adjustable**

**Hypothesis:** Letting users choose improves satisfaction

**Groups:**
- A: Fixed 3 miles
- B: User slider (1-10 miles)

**Metrics:**
- Engagement (do users adjust it?)
- Match rate
- Completion rate

**Expected Results:**
- Most users (~70%) keep default
- Power users appreciate control
- Slightly higher satisfaction in B

---

## 💡 Recommended Settings for MVP

### **Default Configuration:**

```typescript
// backend/.env
DEFAULT_MATCHING_RADIUS_MILES=3
MIN_MATCHING_RADIUS_MILES=1
MAX_MATCHING_RADIUS_MILES=10

// backend/src/constants/matching.ts
export const MATCHING_CONFIG = {
  // Radius in miles
  DEFAULT_RADIUS_MILES: 3,
  MIN_RADIUS_MILES: 1,
  MAX_RADIUS_MILES: 10,
  
  // Converted to meters for Redis GEORADIUS
  DEFAULT_RADIUS_METERS: 3 * 1609.34, // 4,828 meters
  
  // Fallback: expand if no matches
  FALLBACK_RADIUS_MILES: 5,
  
  // Time-based expansion
  NIGHT_RADIUS_MULTIPLIER: 1.3, // 10pm-6am: expand to 4 miles
};
```

### **Usage in Code:**

```typescript
// matchingService.ts
async findMatches(wanna: Wanna): Promise<Wanna[]> {
  let radiusMiles = MATCHING_CONFIG.DEFAULT_RADIUS_MILES;
  
  // Check user preference (Phase 2)
  if (wanna.user.preferences?.matching_radius) {
    radiusMiles = wanna.user.preferences.matching_radius;
  }
  
  // Find nearby wannas
  const nearbyWannas = await this.findNearbyWannas(
    wanna.location,
    radiusMiles
  );
  
  // If no matches, try expanding (one-time fallback)
  if (nearbyWannas.length === 0) {
    radiusMiles = MATCHING_CONFIG.FALLBACK_RADIUS_MILES;
    nearbyWannas = await this.findNearbyWannas(
      wanna.location,
      radiusMiles
    );
  }
  
  // Calculate compatibility scores...
  return compatibleWannas;
}
```

---

## 🎯 Final Recommendation

### **For MVP Launch:**

✅ **Use 3 miles as default**
- Simple, predictable
- Truly spontaneous
- Works in most cities
- Easy to communicate

### **Messaging to Users:**

```
"We're finding people within 3 miles of you"

Why 3 miles?
• About 15 minutes travel time
• Close enough to meet spontaneously
• Same neighborhood vibe

Want to adjust? Go to Settings → Matching Radius
```

### **Future Enhancements (Post-MVP):**

1. **Phase 2:** Add user preference slider
2. **Phase 3:** Density-based automatic adjustment
3. **Phase 4:** Time-based isochrones (20-minute reachable area)

---

## 📏 Quick Reference Table

| Radius | Travel Time | Best For | Match Density | Spontaneity |
|--------|-------------|----------|---------------|-------------|
| 1 mile | 5-10 min | Hyper-local | Very Low | Very High |
| **3 miles** ⭐ | **10-15 min** | **Cities (MVP)** | **Good** | **High** |
| 5 miles | 15-25 min | Suburbs | High | Medium |
| 8 miles | 25-35 min | Low density | Very High | Low |
| 10+ miles | 30-60+ min | Rural | Maximum | Very Low |

---

**Bottom Line:** Start with **3 miles** for MVP. It's the sweet spot for spontaneous urban connection. Expand flexibility in Phase 2 based on real user data. 📍✨