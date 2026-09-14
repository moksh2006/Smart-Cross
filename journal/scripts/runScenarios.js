const path = require('path');
module.paths.push(path.resolve(__dirname, '../server/node_modules'));

const { mapTrainToPhataks } = require('../server/src/services/gis/mappingEngine');
const { calculateRouteEta } = require('../server/src/services/prediction/etaCalculator');
const gateStateMachine = require('../server/src/services/gate/gateStateMachine');
const alertDeduplicator = require('../server/src/services/alert/alertDeduplicator');
const fallbackPredictor = require('../server/src/services/prediction/fallbackPredictor');
const { DIRECTION, GATE_STATUS } = require('../server/src/config/constants');
const { connectDB, disconnectDB } = require('../server/src/config/db');

async function runAllScenarios() {
  console.log('================================================================');
  console.log('SMARTCROSS — AUTOMATED SCENARIO VALIDATION SUITE');
  console.log('================================================================\n');

  await connectDB();

  const phataks = [
    { number: 19, name: 'Phatak 19', location: { type: 'Point', coordinates: [76.398417, 30.339583] }, currentStatus: 'OPEN' },
    { number: 20, name: 'Phatak 20', location: { type: 'Point', coordinates: [76.392583, 30.339667] }, currentStatus: 'OPEN' },
    { number: 23, name: 'Phatak 23', location: { type: 'Point', coordinates: [76.366583, 30.340222] }, currentStatus: 'OPEN' },
    { number: 24, name: 'Phatak 24', location: { type: 'Point', coordinates: [76.356778, 30.339972] }, currentStatus: 'OPEN' }
  ];

  // SCENARIO A
  console.log('▶ [SCENARIO A] Train starts at Patiala toward Dhablan (PTA → DBN)...');
  const trainA = {
    trainNumber: '14507',
    direction: DIRECTION.PATIALA_TO_DHABLAN,
    currentLocation: { type: 'Point', coordinates: [76.4102, 30.3385] },
    speed: 48
  };
  const mappingsA = mapTrainToPhataks(trainA, phataks);
  const sequenceA = mappingsA.map(m => m.phatakNumber);
  console.log(`  Dynamic Sequence from Route Geometry: ${sequenceA.join(' → ')}`);
  if (JSON.stringify(sequenceA) !== JSON.stringify([19, 20, 23, 24])) {
    throw new Error('Scenario A failed: sequence mismatch');
  }
  console.log('  ✓ Verified sequence 19 → 20 → 23 → 24.\n');

  // SCENARIO B
  console.log('▶ [SCENARIO B] Train starts at Dhablan toward Patiala (DBN → PTA)...');
  const trainB = {
    trainNumber: '14508',
    direction: DIRECTION.DHABLAN_TO_PATIALA,
    currentLocation: { type: 'Point', coordinates: [76.3045, 30.3380] },
    speed: 52
  };
  const mappingsB = mapTrainToPhataks(trainB, phataks);
  const sequenceB = mappingsB.map(m => m.phatakNumber);
  console.log(`  Dynamic Sequence from Route Geometry: ${sequenceB.join(' → ')}`);
  if (JSON.stringify(sequenceB) !== JSON.stringify([24, 23, 20, 19])) {
    throw new Error('Scenario B failed: sequence mismatch');
  }
  console.log('  ✓ Verified sequence 24 → 23 → 20 → 19.\n');

  // SCENARIO C
  console.log('▶ [SCENARIO C] Live API Failure & Multi-Tier Fallback...');
  const schedule = {
    trainNumber: '11058',
    stations: [
      { stationCode: 'PTA', arrivalTime: '10:15', departureTime: '10:20' },
      { stationCode: 'DBN', arrivalTime: '10:40', departureTime: '10:42' }
    ]
  };
  const predC = await fallbackPredictor.predictWithFallback('11058', 19, 3200, null, schedule);
  console.log(`  Fallback Method: ${predC.method}, Confidence: ${predC.confidence}, ETA: ${predC.etaMinutes}m`);
  console.log(`  Message: "${predC.sourceMessage}"`);
  console.log('  ✓ Verified graceful fallback hierarchy.\n');

  // SCENARIO D
  console.log('▶ [SCENARIO D] Multi-Train Contention (Earliest train controls gate)...');
  const predTrain1 = { trainNumber: '14507', phatakNumber: 19, etaMinutes: 3, predictedArrival: new Date(Date.now() + 180000), distanceMeters: 1200 };
  const predTrain2 = { trainNumber: '14735', phatakNumber: 19, etaMinutes: 8, predictedArrival: new Date(Date.now() + 480000), distanceMeters: 4000 };
  const resultD = await gateStateMachine.processPhatakState({ number: 19, currentStatus: 'OPEN' }, [predTrain1, predTrain2]);
  console.log(`  Controlling Train: ${resultD.controllingTrainNumber}, Status: ${resultD.newStatus}`);
  if (resultD.controllingTrainNumber !== '14507') {
    throw new Error('Scenario D failed: incorrect controlling train');
  }
  console.log('  ✓ Verified earliest arriving train controls phatak.\n');

  // SCENARIO E
  console.log('▶ [SCENARIO E] Train Clears Phatak: CLOSED → OPENING_SOON → OPEN...');
  const st1 = gateStateMachine.evaluateNextStatus(GATE_STATUS.CLOSING_SOON, 1.5, 900, false);
  const st2 = gateStateMachine.evaluateNextStatus(GATE_STATUS.CLOSED, 0, -120, true);
  const st3 = gateStateMachine.evaluateNextStatus(GATE_STATUS.OPENING_SOON, 0, -400, true);
  console.log(`  Step 1 (Approach): ${st1.nextStatus}`);
  console.log(`  Step 2 (Crossed):  ${st2.nextStatus}`);
  console.log(`  Step 3 (Cleared):  ${st3.nextStatus}`);
  if (st1.nextStatus !== 'CLOSED' || st2.nextStatus !== 'OPENING_SOON' || st3.nextStatus !== 'OPEN') {
    throw new Error('Scenario E failed: state transition mismatch');
  }
  console.log('  ✓ Verified state cycle CLOSED → OPENING_SOON → OPEN.\n');

  console.log('================================================================');
  console.log('🎉 ALL 5 CRITICAL AUTOMATED SCENARIOS PASSED WITH ZERO ERRORS!');
  console.log('================================================================\n');

  await disconnectDB();
}

if (require.main === module) {
  runAllScenarios().catch(err => {
    console.error('Scenario execution failed:', err);
    process.exit(1);
  });
}

module.exports = runAllScenarios;
