const SystemSetting = require('../models/SystemSetting');
const { DEFAULTS } = require('../config/constants');

exports.getSettings = async (req, res, next) => {
  try {
    const settings = await SystemSetting.find();
    const settingsMap = { ...DEFAULTS };

    settings.forEach(s => {
      settingsMap[s.key] = s.value;
    });

    res.json({ success: true, data: settingsMap });
  } catch (err) {
    next(err);
  }
};

exports.updateSetting = async (req, res, next) => {
  try {
    const { key, value, description } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ success: false, message: 'key and value are required' });
    }

    const updated = await SystemSetting.findOneAndUpdate(
      { key },
      { key, value, description: description || '', updatedBy: 'ADMIN_API', updatedAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
};
