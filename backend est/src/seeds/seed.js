/**
 * Idempotent reference-data seeding: crossings (from config/corridor.js),
 * monitored trains, bundled timetables and train->crossing mappings.
 * Never overwrites timetables fetched from the RailRadar API.
 *
 * Run standalone: npm run seed
 */
const corridor = require('../config/corridor');
const bundled = require('../data/bundledTimetable.json');
const { Phatak, Train, TrainSchedule, TrainPhatakMapping } = require('../models');
const log = require('../utils/logger')('seed');

async function seedReferenceData() {
  for (const c of corridor.CROSSINGS) {
    await Phatak.updateOne(
      { number: c.number },
      {
        $set: {
          name: c.name,
          dmsCoordinates: { latitude: c.dms.lat, longitude: c.dms.lon },
          location: { type: 'Point', coordinates: c.coordinates },
          group: c.group,
          chainageMeters: c.chainage,
          distanceFromTrackMeters: c.offTrackMeters,
          nearestRoutePoint: { type: 'Point', coordinates: c.snappedPoint }
        },
        $setOnInsert: { currentStatus: 'UNKNOWN' }
      },
      { upsert: true, runValidators: true }
    );
  }

  for (const s of bundled.trains) {
    const pta = s.stops.find((x) => x.stationCode === 'PTA');
    const dbn = s.stops.find((x) => x.stationCode === 'DBN');
    await Train.updateOne(
      { trainNumber: s.trainNumber },
      {
        $set: { trainName: s.trainName, runningDays: s.runningDays, direction: s.corridorDirection, isMonitored: true },
        $setOnInsert: {
          sourceStation: { code: s.stops[0].stationCode, name: s.stops[0].stationName },
          destinationStation: { code: s.stops[s.stops.length - 1].stationCode, name: s.stops[s.stops.length - 1].stationName }
        }
      },
      { upsert: true, runValidators: true }
    );
    await TrainSchedule.updateOne(
      { trainNumber: s.trainNumber, source: { $ne: 'RAILRADAR_API' } },
      { $set: { ...s, source: 'BUNDLED_SEED', verified: false, fetchedAt: new Date(0) } },
      { upsert: true, runValidators: true }
    ).catch((e) => { if (e.code !== 11000) throw e; }); // API-fetched schedule exists: keep it
    if (pta && dbn) {
      const order = corridor.crossingOrder(s.corridorDirection);
      const entry = corridor.corridorEnds(s.corridorDirection).entry;
      for (let i = 0; i < order.length; i++) {
        await TrainPhatakMapping.updateOne(
          { trainNumber: s.trainNumber, phatakNumber: order[i].number },
          {
            $set: {
              direction: s.corridorDirection,
              sequence: i + 1,
              crossingChainageMeters: order[i].chainage,
              distanceFromEntryMeters: Math.round(Math.abs(order[i].chainage - entry)),
              calculatedAt: new Date()
            }
          },
          { upsert: true, runValidators: true }
        );
      }
    }
  }
  log.info(`Reference data ready: ${corridor.CROSSINGS.length} crossings, ${bundled.trains.length} bundled timetables`);
}

if (require.main === module) {
  // eslint-disable-next-line global-require
  const { connectDB, disconnectDB } = require('../config/db');
  connectDB()
    .then(seedReferenceData)
    .then(() => disconnectDB())
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { seedReferenceData };
