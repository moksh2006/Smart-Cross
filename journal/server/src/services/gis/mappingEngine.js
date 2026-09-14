/**
 * Train to Phatak Mapping Engine
 * Maps trains to phataks along railway route geometry,
 * detects train direction, computes phatak sequence and distance along route.
 */

const { projectPointOnTrack, getTrackGeometry, PTA_TO_DBN_CORRIDOR_TRACK } = require('./routeGeometryProcessor');
const { DIRECTION, CONFIDENCE, DEFAULTS } = require('../../config/constants');

/**
 * Determines train direction from live coordinates, previous coordinates, or schedule.
 * @param {[number, number]} currentCoord [lon, lat]
 * @param {[number, number]|null} previousCoord [lon, lat]
 * @param {object|null} schedule Train schedule with stations
 * @returns {string} Direction enum
 */
function detectTrainDirection(currentCoord, previousCoord = null, schedule = null) {
  // Method 1: Movement vector projection if previous coordinates exist
  if (previousCoord && Array.isArray(previousCoord) && previousCoord.length === 2) {
    const projCurr = projectPointOnTrack(currentCoord, PTA_TO_DBN_CORRIDOR_TRACK);
    const projPrev = projectPointOnTrack(previousCoord, PTA_TO_DBN_CORRIDOR_TRACK);

    const delta = projCurr.distanceAlongRouteMeters - projPrev.distanceAlongRouteMeters;
    if (delta > 20) {
      return DIRECTION.PATIALA_TO_DHABLAN; // Moving East to West
    } else if (delta < -20) {
      return DIRECTION.DHABLAN_TO_PATIALA; // Moving West to East
    }
  }

  // Method 2: Inspect schedule station order (PTA vs DBN)
  if (schedule && Array.isArray(schedule.stations) && schedule.stations.length > 0) {
    let ptaIndex = -1;
    let dbnIndex = -1;

    schedule.stations.forEach((st, idx) => {
      const code = (st.stationCode || '').toUpperCase();
      if (code === 'PTA') ptaIndex = idx;
      if (code === 'DBN') dbnIndex = idx;
    });

    if (ptaIndex !== -1 && dbnIndex !== -1) {
      if (ptaIndex < dbnIndex) {
        return DIRECTION.PATIALA_TO_DHABLAN;
      } else {
        return DIRECTION.DHABLAN_TO_PATIALA;
      }
    }
  }

  // Method 3: Relative position along the corridor
  if (currentCoord && currentCoord.length === 2) {
    const proj = projectPointOnTrack(currentCoord, PTA_TO_DBN_CORRIDOR_TRACK);
    // If very close to PTA (< 1km)
    if (proj.distanceAlongRouteMeters < 1500) {
      return DIRECTION.PATIALA_TO_DHABLAN;
    }
    // If very close to DBN (> 9km)
    if (proj.distanceAlongRouteMeters > 8500) {
      return DIRECTION.DHABLAN_TO_PATIALA;
    }
  }

  return DIRECTION.UNKNOWN;
}

/**
 * Maps a train to the four monitored phataks along the railway track.
 * Calculates route position, perpendicular distance, sequence, and distance from train to each phatak.
 * @param {object} train Train object with currentLocation
 * @param {Array<object>} phataks List of phatak objects
 * @param {number} corridorMeters Max allowed perpendicular distance to route
 * @returns {Array<object>} Array of mapping results sorted in the sequence the train will encounter them
 */
function mapTrainToPhataks(train, phataks, corridorMeters = DEFAULTS.PHATAK_ROUTE_CORRIDOR_METERS) {
  if (!train || !train.currentLocation || !train.currentLocation.coordinates) {
    return [];
  }

  const trainCoord = train.currentLocation.coordinates;
  const direction = train.direction || detectTrainDirection(trainCoord);
  const isPtaToDbn = direction === DIRECTION.PATIALA_TO_DHABLAN;

  // Track polyline oriented in the direction of train movement
  const orientedTrack = getTrackGeometry(isPtaToDbn ? 'PATIALA_TO_DHABLAN' : 'DHABLAN_TO_PATIALA');

  // Train's position along its travel line
  const trainProj = projectPointOnTrack(trainCoord, orientedTrack);

  const mappings = [];

  for (const phatak of phataks) {
    const phatakCoord = phatak.location.coordinates;
    const phatakProj = projectPointOnTrack(phatakCoord, orientedTrack);

    // Corridor check: phatak must be close to the railway track
    const isWithinCorridor = phatakProj.distanceFromTrackMeters <= corridorMeters;

    // Along-track distance from train to phatak
    // Positive means phatak is ahead (downstream), negative means train has already passed it
    const distanceToPhatakMeters = Math.round(
      (phatakProj.distanceAlongRouteMeters - trainProj.distanceAlongRouteMeters) * 10
    ) / 10;

    mappings.push({
      phatakNumber: phatak.number,
      phatakName: phatak.name,
      trainNumber: train.trainNumber,
      isWithinCorridor,
      distanceFromRouteMeters: phatakProj.distanceFromTrackMeters,
      phatakRoutePositionMeters: phatakProj.distanceAlongRouteMeters,
      trainRoutePositionMeters: trainProj.distanceAlongRouteMeters,
      distanceToPhatakMeters,
      hasPassed: distanceToPhatakMeters < -150, // passed if >150m behind train
      direction,
      confidence: isWithinCorridor ? CONFIDENCE.HIGH : CONFIDENCE.LOW
    });
  }

  // Filter only phataks within the route corridor
  const corridorMappings = mappings.filter(m => m.isWithinCorridor);

  // Dynamic sequence calculation based on phatakRoutePositionMeters along the train's directional line
  corridorMappings.sort((a, b) => a.phatakRoutePositionMeters - b.phatakRoutePositionMeters);

  // Assign 1-based sequence
  corridorMappings.forEach((mapping, idx) => {
    mapping.sequence = idx + 1;
  });

  return corridorMappings;
}

module.exports = {
  detectTrainDirection,
  mapTrainToPhataks
};
