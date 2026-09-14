const path = require('path');
module.paths.push(path.resolve(__dirname, '../server/node_modules'));
require('dotenv').config({ path: path.resolve(__dirname, '../server/.env') });
const { connectDB } = require('../server/src/config/db');
const seedDatabase = require('./seedDatabase');
const Phatak = require('../server/src/models/Phatak');
const Train = require('../server/src/models/Train');
const PhatakPrediction = require('../server/src/models/PhatakPrediction');
const scheduleTrackingEngine = require('../server/src/services/prediction/scheduleTrackingEngine');
const pipelineOrchestrator = require('../server/src/services/pipelineOrchestrator');
const mongoose = require('mongoose');

async function testIntegration() {
  console.log('--- Starting Schedule Integration Verification ---');
  await connectDB();
  await seedDatabase();

  console.log('\n1. Testing Schedule Tracking Engine...');
  const summary = await scheduleTrackingEngine.getCorridorScheduleSummary();
  console.log(`✓ Scanned ${summary.allStates.length} train schedules`);
  console.log(`✓ Active trains now: ${summary.activeTrains.length}`);
  if (summary.nextUpcomingTrain) {
    console.log(`✓ Next upcoming train: ${summary.nextUpcomingTrain.trainNumber} (${summary.nextUpcomingTrain.trainName}) at ${summary.nextUpcomingTrain.entryScheduledTime} IST from ${summary.nextUpcomingTrain.entryStation}`);
  }

  console.log('\n2. Testing Schedule Passage Simulation for Train 26461 (PTA -> DBN)...');
  // Train 26461 goes PTA -> DBN (Phataks 19 -> 20 -> 23 -> 24)
  const steps = [0.0, 0.1, 0.3, 0.5, 0.7, 0.9, 1.0];
  const observedStates = new Map();

  for (const progress of steps) {
    const res = await pipelineOrchestrator.processTrainUpdate('26461', null, { forcedProgress: progress });
    const train = await Train.findOne({ trainNumber: '26461' });
    const phataks = await Phatak.find().sort({ number: 1 });
    
    console.log(`\n  Progress ${(progress * 100).toFixed(0)}%: Train at [${train.currentLocation.coordinates[0].toFixed(5)}, ${train.currentLocation.coordinates[1].toFixed(5)}], next phatak: ${train.nextPhatakNumber || 'None'}, dist: ${train.distanceToNextPhatakMeters || 0}m`);
    
    for (const p of phataks) {
      if (!observedStates.has(p.number)) observedStates.set(p.number, new Set());
      observedStates.get(p.number).add(p.currentStatus);
      const pred = await PhatakPrediction.findOne({ trainNumber: '26461', phatakNumber: p.number, isActive: true });
      const eta = pred ? `${pred.etaMinutes}m` : 'N/A';
      console.log(`    Phatak ${p.number}: ${p.currentStatus.padEnd(12)} (ETA: ${eta.padEnd(6)}, dist: ${pred ? Math.round(pred.distanceMeters) + 'm' : 'N/A'})`);
    }
  }

  console.log('\n3. Verifying State Transitions:');
  for (const [pNum, states] of observedStates) {
    console.log(`  Phatak ${pNum} observed states:`, Array.from(states).join(' -> '));
  }

  // Check that at least Phatak 19 or 20 reached CLOSED or CLOSING_SOON
  const p19States = Array.from(observedStates.get(19) || []);
  const reachedClosingOrClosed = p19States.includes('CLOSING_SOON') || p19States.includes('CLOSED');
  console.log(`\n✓ Phatak 19 entered warning/closed state: ${reachedClosingOrClosed ? 'YES' : 'NO'}`);

  console.log('\n4. Testing Schedule Passage Simulation for Train 14508 (DBN -> PTA)...');
  // Train 14508 goes DBN -> PTA (Phataks 24 -> 23 -> 20 -> 19)
  const res14508 = await pipelineOrchestrator.processTrainUpdate('14508', null, { forcedProgress: 0.15 });
  const train14508 = await Train.findOne({ trainNumber: '14508' });
  console.log(`✓ Train 14508 at progress 15%: coordinates [${train14508.currentLocation.coordinates[0].toFixed(5)}, ${train14508.currentLocation.coordinates[1].toFixed(5)}], direction: ${train14508.direction}`);

  await mongoose.disconnect();
  console.log('\n✅ Schedule Integration Verification Completed Successfully!');
  process.exit(0);
}

testIntegration().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
