// Real satellite vegetation index per plot (AgroMonitoring / Sentinel-2 & Landsat-8).
// agro_polygons: which provider polygon stands for which main plot (created once per geometry).
// ndvi_observations: one row per satellite pass, kept so history grows and screens never wait on the API.
module.exports = {
  description: 'agro_polygons + ndvi_observations',
  up(db) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agro_polygons (
        plot_id TEXT PRIMARY KEY,
        polygon_id TEXT NOT NULL,
        area_ha REAL,
        geom_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_sync_at DATETIME
      );
      CREATE TABLE IF NOT EXISTS ndvi_observations (
        plot_id TEXT NOT NULL,
        dt INTEGER NOT NULL,
        source TEXT NOT NULL DEFAULT '',
        cloud REAL,
        coverage REAL,
        mean REAL, median REAL, min REAL, max REAL, std REAL, p25 REAL, p75 REAL, num INTEGER,
        PRIMARY KEY (plot_id, dt, source)
      );
      CREATE INDEX IF NOT EXISTS idx_ndvi_plot_dt ON ndvi_observations(plot_id, dt);
    `);
  }
};
