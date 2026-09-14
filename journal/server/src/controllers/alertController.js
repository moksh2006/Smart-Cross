const Alert = require('../models/Alert');
const NotificationSubscription = require('../models/NotificationSubscription');

exports.getRecentAlerts = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || 50, 10);
    const phatakNumber = req.query.phatak ? parseInt(req.query.phatak, 10) : null;

    const query = {};
    if (phatakNumber) query.phatakNumber = phatakNumber;

    const alerts = await Alert.find(query).sort({ createdAt: -1 }).limit(limit);
    res.json({ success: true, count: alerts.length, data: alerts });
  } catch (err) {
    next(err);
  }
};

exports.subscribePush = async (req, res, next) => {
  try {
    const { endpoint, keys, phatakNumbers, browserInfo } = req.body;

    if (!endpoint) {
      return res.status(400).json({ success: false, message: 'Endpoint is required' });
    }

    const sub = await NotificationSubscription.findOneAndUpdate(
      { endpoint },
      {
        endpoint,
        keys: keys || {},
        phatakNumbers: phatakNumbers || [19, 20, 23, 24],
        browserInfo: browserInfo || req.headers['user-agent'] || '',
        createdAt: new Date()
      },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: 'Subscription stored', data: sub });
  } catch (err) {
    next(err);
  }
};
