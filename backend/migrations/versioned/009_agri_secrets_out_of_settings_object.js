// agriSettings (sent to every browser) used to carry the OpenWeather / AgroMonitoring / Sentinel keys.
// Move any key found there to its own hidden setting and strip it from the object.
module.exports = {
  description: 'Move API keys out of agriSettings',
  phase: 'late',
  up(db) {
    const row = db.prepare("SELECT value FROM system_settings WHERE key = 'agriSettings'").get();
    if (!row || !row.value) return;
    let obj;
    try { obj = JSON.parse(row.value); } catch { return; }
    if (!obj || typeof obj !== 'object') return;
    const put = db.prepare(`INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
                            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`);
    let changed = false;
    for (const k of ['openWeatherKey', 'agroMonitoringKey', 'openMeteoKey', 'sentinelClientId', 'sentinelSecret']) {
      if (!(k in obj)) continue;
      const v = String(obj[k] || '').trim();
      const existing = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(k);
      const hasExisting = existing && existing.value && existing.value !== '""';
      if (v && !hasExisting) put.run(k, JSON.stringify(v));
      delete obj[k];
      changed = true;
    }
    if (changed) put.run('agriSettings', JSON.stringify(obj));
  }
};
