const path = require('path');
module.paths.push(path.resolve(__dirname, '../server/node_modules'));
require('dotenv').config({ path: path.resolve(__dirname, '../server/.env') });
const { connectDB, disconnectDB } = require('../server/src/config/db');
const Phatak = require('../server/src/models/Phatak');
const Train = require('../server/src/models/Train');
const TrainRoute = require('../server/src/models/TrainRoute');
const TrainSchedule = require('../server/src/models/TrainSchedule');
const SystemSetting = require('../server/src/models/SystemSetting');
const { dmsToGeoJsonPoint } = require('../server/src/services/gis/coordinateConverter');
const { haversineDistance } = require('../server/src/services/gis/distanceCalculator');
const { projectPointOnTrack, PTA_TO_DBN_CORRIDOR_TRACK } = require('../server/src/services/gis/routeGeometryProcessor');
const { DEFAULTS, STATIONS, INITIAL_TRAIN_NUMBERS } = require('../server/src/config/constants');
const { SUPPLIED_COORDINATES } = require('./verifyCoordinates');
const { MONITORED_TRAIN_SCHEDULES } = require('../server/src/data/monitoredTrainSchedules');

const INITIAL_TRAIN_METADATA = [
  { trainNumber: '14508', trainName: 'Fazilka - Delhi Express', direction: 'DHABLAN_TO_PATIALA', source: 'FKA', dest: 'DLI' },
  { trainNumber: '14815', trainName: 'Sri Ganganagar - Rishikesh Intercity', direction: 'PATIALA_TO_DHABLAN', source: 'SGNR', dest: 'RKSH' },
  { trainNumber: '54552', trainName: 'Bathinda - Ambala Passenger', direction: 'DHABLAN_TO_PATIALA', source: 'BTI', dest: 'UMB' },
  { trainNumber: '11058', trainName: 'Amritsar - Mumbai CSMT Express', direction: 'DHABLAN_TO_PATIALA', source: 'ASR', dest: 'CSMT' },
  { trainNumber: '14735', trainName: 'Sri Ganganagar - Ambala Cantt Express', direction: 'PATIALA_TO_DHABLAN', source: 'SGNR', dest: 'UMB' },
  { trainNumber: '14526', trainName: 'Sriganganagar - Ambala Cantt Intercity', direction: 'DHABLAN_TO_PATIALA', source: 'SGNR', dest: 'UMB' },
  { trainNumber: '14510', trainName: 'Bathinda - Delhi Express', direction: 'DHABLAN_TO_PATIALA', source: 'BTI', dest: 'DLI' },
  { trainNumber: '14736', trainName: 'Ambala Cantt - Sri Ganganagar Express', direction: 'PATIALA_TO_DHABLAN', source: 'UMB', dest: 'SGNR' },
  { trainNumber: '11057', trainName: 'Mumbai CSMT - Amritsar Express', direction: 'PATIALA_TO_DHABLAN', source: 'CSMT', dest: 'ASR' },
  { trainNumber: '54551', trainName: 'Ambala - Bathinda Passenger', direction: 'PATIALA_TO_DHABLAN', source: 'UMB', dest: 'BTI' },
  { trainNumber: '14507', trainName: 'Delhi - Fazilka Express', direction: 'PATIALA_TO_DHABLAN', source: 'DLI', dest: 'FKA' },
  { trainNumber: '54553', trainName: 'Ambala - Dhuri Passenger', direction: 'PATIALA_TO_DHABLAN', source: 'UMB', dest: 'DUI' },
  { trainNumber: '14816', trainName: 'Rishikesh - Sri Ganganagar Intercity', direction: 'DHABLAN_TO_PATIALA', source: 'RKSH', dest: 'SGNR' },
  { trainNumber: '26461', trainName: 'Patiala - Bathinda Special', direction: 'PATIALA_TO_DHABLAN', source: 'PTA', dest: 'BTI' },
  { trainNumber: '26462', trainName: 'Bathinda - Patiala Special', direction: 'DHABLAN_TO_PATIALA', source: 'BTI', dest: 'PTA' }
];

async function seed() {
  console.log('--- Starting SmartCross Database Seeding ---');
  await connectDB();

  // 1. Seed System Settings
  console.log('Seeding System Settings...');
  for (const [key, value] of Object.entries(DEFAULTS)) {
    await SystemSetting.findOneAndUpdate(
      { key },
      { key, value, description: `Default setting for ${key}`, updatedBy: 'SEED_SCRIPT' },
      { upsert: true }
    );
  }
  await SystemSetting.findOneAndUpdate(
    { key: 'MONITORED_TRAIN_NUMBERS' },
    { key: 'MONITORED_TRAIN_NUMBERS', value: INITIAL_TRAIN_NUMBERS, description: 'List of monitored train numbers', updatedBy: 'SEED_SCRIPT' },
    { upsert: true }
  );

  // 2. Seed 4 Phataks using supplied coordinates
  console.log('Seeding 4 Railway Phataks (19, 20, 23, 24)...');
  const seededPhataks = [];

  for (const item of SUPPLIED_COORDINATES) {
    const geoPoint = dmsToGeoJsonPoint(item.latDms, item.lonDms);
    const proj = projectPointOnTrack(geoPoint.coordinates, PTA_TO_DBN_CORRIDOR_TRACK);

    const doc = await Phatak.findOneAndUpdate(
      { number: item.number },
      {
        name: item.name,
        number: item.number,
        dmsCoordinates: { latitude: item.latDms, longitude: item.lonDms },
        location: geoPoint,
        stationCorridor: 'PTA-DBN',
        currentStatus: 'OPEN',
        alertRadius: DEFAULTS.DEFAULT_ALERT_RADIUS_METERS,
        routeCorridorMeters: DEFAULTS.PHATAK_ROUTE_CORRIDOR_METERS,
        nearestRoutePoint: { type: 'Point', coordinates: proj.nearestPoint },
        distanceFromTrackMeters: proj.distanceFromTrackMeters,
        routePositionMeters: proj.distanceAlongRouteMeters,
        statusUpdatedAt: new Date()
      },
      { new: true, upsert: true }
    );
    seededPhataks.push(doc);
    console.log(`  ✓ Phatak ${item.number} seeded at [${geoPoint.coordinates[0]}, ${geoPoint.coordinates[1]}]`);
  }

  // Calculate and store distances between each pair of phataks
  for (const p1 of seededPhataks) {
    const distMap = {};
    for (const p2 of seededPhataks) {
      if (p1.number !== p2.number) {
        distMap[p2.number.toString()] = haversineDistance(p1.location.coordinates, p2.location.coordinates);
      }
    }
    p1.calculatedDistances = distMap;
    await p1.save();
  }

  // 3. Seed 15 Monitored Trains
  console.log('Seeding 15 Monitored Trains...');
  for (const t of INITIAL_TRAIN_METADATA) {
    // Initial position: if PTA->DBN start near PTA; if DBN->PTA start near DBN
    const initialCoords = t.direction === 'PATIALA_TO_DHABLAN'
      ? STATIONS.PATIALA.coordinates
      : STATIONS.DHABLAN.coordinates;

    await Train.findOneAndUpdate(
      { trainNumber: t.trainNumber },
      {
        trainNumber: t.trainNumber,
        trainName: t.trainName,
        sourceStation: { code: t.source, name: t.source },
        destinationStation: { code: t.dest, name: t.dest },
        runningDays: ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'],
        currentLocation: { type: 'Point', coordinates: initialCoords },
        speed: 0,
        delayMinutes: 0,
        direction: t.direction,
        status: 'SCHEDULED',
        dataSource: 'TIMETABLE',
        isMonitored: true,
        lastUpdatedAt: new Date()
      },
      { upsert: true }
    );

    // Also seed baseline route geometry for each train
    await TrainRoute.findOneAndUpdate(
      { trainNumber: t.trainNumber },
      {
        trainNumber: t.trainNumber,
        geometry: {
          type: 'LineString',
          coordinates: t.direction === 'PATIALA_TO_DHABLAN' ? PTA_TO_DBN_CORRIDOR_TRACK : [...PTA_TO_DBN_CORRIDOR_TRACK].reverse()
        },
        fetchedAt: new Date()
      },
      { upsert: true }
    );

    console.log(`  ✓ Train ${t.trainNumber} (${t.trainName}) seeded [${t.direction}]`);
  }

  // 4. Seed 15 Train Schedules (Authoritative Northern Railway Timetable)
  console.log('Seeding 15 Train Schedules (Authoritative Timetable)...');
  const farFutureExpiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
  for (const s of MONITORED_TRAIN_SCHEDULES) {
    await TrainSchedule.findOneAndUpdate(
      { trainNumber: s.trainNumber },
      {
        ...s,
        fetchedAt: new Date(),
        expiresAt: farFutureExpiresAt
      },
      { upsert: true, new: true }
    );
    console.log(`  ✓ Timetable ${s.trainNumber} seeded [${s.entryStationCode} ${s.entryScheduledTime} → ${s.exitStationCode} ${s.exitScheduledTime}]`);
  }

  console.log('\n✅ Database Seeding Completed Successfully.');
  if (require.main === module) {
    await disconnectDB();
  }
}

if (require.main === module) {
  seed().catch(err => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
}

module.exports = seed;
