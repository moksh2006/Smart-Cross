const Phatak = require('../models/Phatak');
const PhatakPrediction = require('../models/PhatakPrediction');
const GateEvent = require('../models/GateEvent');
const { haversineDistance } = require('../services/gis/distanceCalculator');

exports.getAllPhataks = async (req, res, next) => {
  try {
    const phataks = await Phatak.find().sort({ number: 1 });
    const predictions = await PhatakPrediction.find({ isActive: true });

    // Join active prediction for each phatak
    const result = phataks.map(p => {
      const pred = predictions.find(pr => pr.phatakNumber === p.number);
      return {
        ...p.toObject(),
        prediction: pred || null
      };
    });

    res.json({ success: true, count: result.length, data: result });
  } catch (err) {
    next(err);
  }
};

exports.getPhatakById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const phatak = await Phatak.findOne({ number: id });
    if (!phatak) {
      return res.status(404).json({ success: false, message: `Phatak ${id} not found` });
    }

    const prediction = await PhatakPrediction.findOne({ phatakNumber: id, isActive: true })
      .sort({ calculatedAt: -1 });

    const recentEvents = await GateEvent.find({ phatakNumber: id })
      .sort({ timestamp: -1 })
      .limit(20);

    res.json({
      success: true,
      data: {
        ...phatak.toObject(),
        prediction,
        events: recentEvents
      }
    });
  } catch (err) {
    next(err);
  }
};

exports.getNearbyPhataks = async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);
    const radiusMeters = parseFloat(req.query.radius || 1500);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ success: false, message: 'Invalid lat/lon parameters' });
    }

    const phataks = await Phatak.find();
    const userCoord = [lon, lat];

    const nearby = phataks.map(p => {
      const dist = haversineDistance(userCoord, p.location.coordinates);
      return {
        ...p.toObject(),
        distanceFromUserMeters: dist,
        isNearby: dist <= radiusMeters
      };
    }).sort((a, b) => a.distanceFromUserMeters - b.distanceFromUserMeters);

    res.json({
      success: true,
      userLocation: { lat, lon },
      radiusMeters,
      count: nearby.length,
      data: nearby
    });
  } catch (err) {
    next(err);
  }
};
