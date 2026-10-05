// One-time startup tasks: seed data, schema migrations, AI key.
const db = require('./db');
const config = require('./config');
const AgriAI = require('./agri_ai_service');
const { seedDatabase } = require('./seeds/seed');
const { runMigration } = require('./migrations/migrate');
const { runCropSourcesMigration } = require('./migrations/migrate_crop_sources');
const { runBatchAndNotesMigration } = require('./migrations/migrate_batch_and_notes');
const { runGisPlotsMigration } = require('./migrations/migrate_gis_plots');
const { runMultiRoleAndContractsMigration } = require('./migrations/migrate_multirole_contracts');
const { runInvestorsModuleMigration } = require('./migrations/migrate_investors_module');
const { seedRealisticOperations } = require('./seeds/seed_realistic_operations');
const { runVersionedMigrations } = require('./migrations/runner');

function runStartupTasks() {
  // Ensure seed data exists and database schema is migrated
  seedDatabase();
  runMigration();
  runCropSourcesMigration();
  runBatchAndNotesMigration();
  runGisPlotsMigration();
  runMultiRoleAndContractsMigration();
  runInvestorsModuleMigration();
  seedRealisticOperations();
  runVersionedMigrations(db.db, 'late');
  // Re-create the tree sync triggers if a maintenance script ever rebuilt the palms table (idempotent).
  require('./migrations/versioned/006_palms_row_version').up(db.db);
  require('./migrations/versioned/007_operations_row_version').up(db.db);

  // Satellite readings: a fresh server (e.g. the free demo after it wakes up) fetches them by itself
  try {
    const Agro = require('./lib/agro');
    const hasObs = db.get('SELECT COUNT(*) AS n FROM ndvi_observations')?.n > 0;
    if (Agro.status().satellite.configured && !hasObs && process.env.NDVI_AUTO_SYNC !== 'false') {
      setTimeout(() => {
        Agro.syncNdvi({ maxPlots: 40 })
          .then(r => console.log(`[ndvi] start-up sync: ${r.processed || 0} plots, ${r.observationsAdded || 0} images${r.error ? ' — ' + r.error : ''}`))
          .catch(err => console.warn('[ndvi] start-up sync failed:', err.message));
      }, 20000).unref();
    }
  } catch (err) { console.warn('[ndvi] start-up sync skipped:', err.message); }

  // Initialize AgriAI API key: environment (.env) first, then the key saved from the admin settings screen.
  try {
    const row = db.get("SELECT value FROM system_settings WHERE key = 'gemini_api_key' OR key = 'geminiApiKey'");
    let k = config.GEMINI_API_KEY;
    if (!k && row && row.value) {
      k = row.value;
      try { k = JSON.parse(k); } catch(e) {}
    }
    if (k) AgriAI.setApiKey(k);
    else console.warn('AgriAI: no Gemini API key configured (set GEMINI_API_KEY in .env or from the admin settings screen).');
  } catch(e) {
    console.warn('AgriAI key startup init warning:', e.message);
  }
}

module.exports = { runStartupTasks };
