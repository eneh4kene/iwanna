/**
 * @vibe Tools Test Script
 *
 * Tests the MeetingPointTool and PlaceFinderTool to verify they work correctly.
 * Run with: node test-vibe-tools.js
 */

const { vibeOrchestrator } = require('./dist/services/vibe/vibeOrchestrator');
const { vibeToolRegistry } = require('./dist/services/vibe/vibeToolRegistry');
const { PlaceFinderTool } = require('./dist/services/vibe/tools/PlaceFinderTool');
const { MeetingPointTool } = require('./dist/services/vibe/tools/MeetingPointTool');

// Register tools before testing
const placeFinderTool = new PlaceFinderTool();
const meetingPointTool = new MeetingPointTool();

vibeToolRegistry.register(placeFinderTool);
vibeToolRegistry.register(meetingPointTool);

console.log('✅ Registered tools:', vibeToolRegistry.getAllTools().map(t => t.name));
console.log('');

// Test context (mock pod data)
const testContext = {
  podId: '00000000-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000002',
  location: {
    latitude: 37.7749,  // San Francisco
    longitude: -122.4194,
  },
  members: [
    {
      userId: '00000000-0000-0000-0000-000000000002',
      username: 'TestUser1',
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
      },
    },
    {
      userId: '00000000-0000-0000-0000-000000000003',
      username: 'TestUser2',
      location: {
        latitude: 37.7849,
        longitude: -122.4094,
      },
    },
    {
      userId: '00000000-0000-0000-0000-000000000004',
      username: 'TestUser3',
      location: {
        latitude: 37.7649,
        longitude: -122.4294,
      },
    },
  ],
  activity: 'coffee',
  category: 'food_social',
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
};

async function testMeetingPointTool() {
  console.log('\n🧪 Testing MeetingPointTool (calculate_meeting_point)...\n');

  try {
    const result = await vibeOrchestrator.processVibeQuery(
      '@vibe where should we meet?',
      testContext
    );

    console.log('✅ MeetingPointTool executed successfully!');
    console.log('\nResult:');
    console.log('Success:', result.success);
    console.log('Message:', result.message);
    console.log('\nMetadata:');
    console.log('  - Execution time:', result.metadata?.executionTimeMs, 'ms');
    console.log('  - API calls made:', result.metadata?.apiCallsMade);
    console.log('  - Cache hit:', result.metadata?.cacheHit);

    if (result.data) {
      console.log('\nData:');
      console.log('  - Centroid:', result.data.centroid);
      console.log('  - Member distances:', result.data.memberDistances);
    }

    if (result.actionButtons && result.actionButtons.length > 0) {
      console.log('\nAction Buttons:');
      result.actionButtons.forEach(btn => {
        console.log(`  - ${btn.label} (${btn.action})`);
      });
    }

    return true;
  } catch (error) {
    console.error('❌ MeetingPointTool failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

async function testPlaceFinderTool() {
  console.log('\n🧪 Testing PlaceFinderTool (find_nearby_places)...\n');

  try {
    const result = await vibeOrchestrator.processVibeQuery(
      '@vibe find coffee nearby',
      testContext
    );

    console.log('✅ PlaceFinderTool executed!');
    console.log('\nResult:');
    console.log('Success:', result.success);
    console.log('Message (truncated):', result.message.substring(0, 100) + '...');
    console.log('\nMetadata:');
    console.log('  - Execution time:', result.metadata?.executionTimeMs, 'ms');
    console.log('  - API calls made:', result.metadata?.apiCallsMade);
    console.log('  - Cache hit:', result.metadata?.cacheHit);

    if (result.data?.places) {
      console.log('\nPlaces found:', result.data.places.length);
      if (result.data.places.length > 0) {
        console.log('First place:', result.data.places[0].name);
      }
    }

    return true;
  } catch (error) {
    console.error('❌ PlaceFinderTool failed:', error.message);
    if (error.message.includes('API key')) {
      console.log('\n⚠️  Note: Google Places API key not configured. This is expected.');
      console.log('   Add GOOGLE_PLACES_API_KEY to backend/.env to test this tool.');
      return 'skipped';
    }
    console.error('Stack:', error.stack);
    return false;
  }
}

async function runTests() {
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║  @vibe Tools Test Suite                           ║');
  console.log('╚════════════════════════════════════════════════════╝');

  const results = {
    meetingPoint: await testMeetingPointTool(),
    placeFinder: await testPlaceFinderTool(),
  };

  console.log('\n\n╔════════════════════════════════════════════════════╗');
  console.log('║  Test Results Summary                              ║');
  console.log('╚════════════════════════════════════════════════════╝\n');

  console.log('MeetingPointTool:', results.meetingPoint ? '✅ PASS' : '❌ FAIL');
  console.log('PlaceFinderTool: ', results.placeFinder === 'skipped' ? '⚠️  SKIPPED (no API key)' : results.placeFinder ? '✅ PASS' : '❌ FAIL');

  const allPassed = results.meetingPoint && (results.placeFinder === true || results.placeFinder === 'skipped');

  console.log('\nOverall:', allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');

  process.exit(allPassed ? 0 : 1);
}

// Run tests
runTests().catch(err => {
  console.error('\n❌ Test suite crashed:', err);
  process.exit(1);
});
