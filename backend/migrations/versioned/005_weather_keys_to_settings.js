// The OpenWeather / AgroMonitoring keys used to be hard-coded in frontend/js/ai-hub.js.
// They now live in system_settings (editable from the Agri-AI settings tab). This copies the
// previous values in once, so existing installs keep working without any action.
module.exports = {
  description: 'Move weather API keys from frontend code into system_settings',
  phase: 'late', // system_settings is created by the legacy startup migrations on a fresh database
  up(db) {
    const put = (key, value) => {
      if (!value) return;
      const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
      if (row && row.value && row.value !== '""') return;
      db.prepare(`INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
                  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`).run(key, JSON.stringify(value));
    };
    // Keys are no longer embedded in the code: existing installs already copied them on first run;
    // new installs set them from the AI settings screen or the environment.
    put('openWeatherKey', process.env.OPENWEATHER_API_KEY || '');
    put('agroMonitoringKey', process.env.AGROMONITORING_API_KEY || '');
  }
};
