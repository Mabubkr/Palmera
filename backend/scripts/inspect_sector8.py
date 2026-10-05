import sqlite3
import sys

sys.stdout.reconfigure(encoding='utf-8')

for path in ['backend/palmtrace.db', r'd:\Palm Trees Administration system\PalmTrace October version\backend\palmtrace.db']:
    try:
        db = sqlite3.connect(path)
        c = db.cursor()
        c.execute("PRAGMA table_info(sectors)")
        print("Sectors columns:", [r[1] for r in c.fetchall()])
        c.execute("SELECT * FROM sectors")
        all_secs = c.fetchall()
        print(f"=== DB: {path} ===")
        print("All sectors:", all_secs)
        
        c.execute("SELECT id, name FROM sectors WHERE id LIKE '%8%' OR name LIKE '%8%'")
        sec8 = c.fetchall()
        print("Sector 8 found:", sec8)
        
        if sec8:
            sec_id = sec8[0][0]
            c.execute("SELECT id, name, area_value, parent_plot_id FROM plots WHERE sector_id = ? OR id LIKE ?", (sec_id, f"{sec_id}%"))
            plots = c.fetchall()
            print(f"Plots count for {sec_id}:", len(plots))
            for pl in plots[:10]:
                print("  Plot:", pl)
            
            c.execute("SELECT count(*), variety_id, crop_id FROM palms WHERE plot_id LIKE ? GROUP BY variety_id, crop_id", (f"{sec_id}%",))
            print("Palms in palms table:", c.fetchall())
            
            c.execute("SELECT code, plot_id, variety_id FROM palms WHERE plot_id LIKE ? LIMIT 5", (f"{sec_id}%",))
            print("Sample palms:", c.fetchall())
            
        c.execute("SELECT count(*) FROM palms")
        print("Total palms in DB:", c.fetchone()[0])
        db.close()
    except Exception as e:
        print("Error with", path, e)
