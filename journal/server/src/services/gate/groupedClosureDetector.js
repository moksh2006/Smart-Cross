/**
 * Grouped Closure Detector
 * Analyzes proximity pairs (19 & 20, 23 & 24) to detect concurrent closure advisories.
 */

const { DEFAULTS } = require('../../config/constants');

const CLOSE_PAIRS = [
  [19, 20],
  [23, 24]
];

/**
 * Checks whether closely spaced phatak pairs are closing concurrently.
 * @param {Map<number, object> | object} phatakPredictions Map of phatakNumber -> active prediction
 * @param {number} toleranceSeconds Configured tolerance in seconds
 * @returns {Array<object>} Array of grouped closure alerts/advisories
 */
function detectGroupedClosures(phatakPredictions, toleranceSeconds = DEFAULTS.GROUPED_CLOSURE_TOLERANCE_SECONDS) {
  const getPred = (num) => {
    if (phatakPredictions instanceof Map) return phatakPredictions.get(num);
    return phatakPredictions[num];
  };

  const groupedAdvisories = [];

  for (const [p1, p2] of CLOSE_PAIRS) {
    const pred1 = getPred(p1);
    const pred2 = getPred(p2);

    if (pred1 && pred2 && pred1.predictedClosure && pred2.predictedClosure) {
      const time1 = new Date(pred1.predictedClosure).getTime();
      const time2 = new Date(pred2.predictedClosure).getTime();

      const diffSec = Math.abs(time1 - time2) / 1000;

      if (diffSec <= toleranceSeconds) {
        groupedAdvisories.push({
          pair: [p1, p2],
          message: `Nearby Phataks ${p1} & ${p2} are closing within ${Math.round(diffSec)} seconds of each other. Expect traffic congestion.`,
          differenceSeconds: Math.round(diffSec),
          trainNumber: pred1.trainNumber || pred2.trainNumber
        });
      }
    }
  }

  return groupedAdvisories;
}

module.exports = {
  detectGroupedClosures,
  CLOSE_PAIRS
};
