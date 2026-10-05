// PalmTrace app — Photo queue, Excel imports, GIS map, DOM event binding, harvest stickers
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

function enqueue(title, detail) {
  const st = Store.get();
  st.queue.push({ id: Store.uid("q"), title, detail, at: new Date().toISOString(), status: "pending" });
  Store.set({ queue: st.queue });
}
async function compressImage(file) {
  return new Promise((res) => {
    const img = new Image(); const rd = new FileReader();
    rd.onload = () => { img.onload = () => {
      const c = document.createElement("canvas");
      const max = 900; const scale = Math.min(1, max / Math.max(img.width, img.height));
      c.width = img.width * scale; c.height = img.height * scale;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", 0.7));
    }; img.src = rd.result; };
    rd.readAsDataURL(file);
  });
}

function isPointInPolygon(point, vs) {
  if (!vs || vs.length < 3) return true;
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function initPlotsImport() {
  const fileInput = document.getElementById("plots-file-input");
  if (!fileInput) return;
  const fileDiv = document.getElementById("plots-selected-file");
  const importBtn = document.getElementById("btn-do-plots-import");
  const resDiv = document.getElementById("plots-import-result");
  const dropZone = document.getElementById("plots-drop-zone");
  const pickBtn = document.getElementById("btn-pick-plots-file");

  let selectedPlotsFile = null;

  const handlePlotsFile = (file) => {
    if (!file) return;
    selectedPlotsFile = file;
    if (fileDiv) {
      fileDiv.innerHTML = `
        <div style="background:#F0FDF4;border:1px solid #86EFAC;color:#166534;padding:8px 14px;border-radius:8px;display:inline-flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;box-shadow:0 1px 2px rgba(0,0,0,0.05)">
          <span style="font-size:16px">📄</span>
          <b>${escapeHtml(file.name)}</b>
          <span style="font-size:11px;color:#15803D">(${(file.size / 1024).toFixed(1)} كيلوبايت)</span>
          <span style="color:#16A34A;font-size:14px">✓</span>
        </div>
      `;
    }
    if (importBtn) {
      importBtn.disabled = false;
      importBtn.style.cursor = "pointer";
      importBtn.style.opacity = "1";
      importBtn.style.pointerEvents = "auto";
    }
  };

  if (pickBtn) {
    pickBtn.onclick = (e) => {
      e.stopPropagation();
      fileInput.click();
    };
  }

  if (dropZone) {
    dropZone.onclick = (e) => {
      if (e.target !== fileInput) {
        fileInput.click();
      }
    };
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = "#0284C7"; dropZone.style.background = "#F0F9FF"; };
    dropZone.ondragleave = () => { dropZone.style.borderColor = "#CBD5E1"; dropZone.style.background = "#F8FAFC"; };
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "#CBD5E1";
      dropZone.style.background = "#F8FAFC";
      const file = e.dataTransfer?.files?.[0];
      handlePlotsFile(file);
    };
  }

  fileInput.onclick = (e) => {
    e.stopPropagation();
    e.target.value = null;
  };

  fileInput.onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    handlePlotsFile(file);
  };

  if (importBtn) {
    importBtn.onclick = async () => {
      if (!selectedPlotsFile) {
        toast("يرجى اختيار ملف الإكسل أولاً", "warn");
        return;
      }
      importBtn.disabled = true;
      importBtn.textContent = "جاري التحليل واستيراد القطع...";
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const base64 = ev.target.result;
          const resp = await fetch("/api/plots/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64, filename: selectedPlotsFile.name })
          });
          const data = await resp.json();
          if (resDiv) {
            resDiv.style.display = "block";
            if (data.success) {
              resDiv.innerHTML = `
                <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:12px;color:#065F46">
                  <div style="font-weight:bold;font-size:14px">🎉 تم الاستيراد بنجاح!</div>
                  <div style="font-size:12px;margin-top:4px">
                    تم إنشاء وتحديث <b>${data.importedCount}</b> قطعة أرضية، وتحديث محيط <b>${data.affectedSectorsCount}</b> قطاع زراعي.
                  </div>
                </div>
              `;
              toast(`تم استيراد ${data.importedCount} قطعة بنجاح!`);
              setTimeout(async () => {
                showPlotImportModal = false;
                if (typeof Api !== "undefined" && typeof Api.pullLatest === "function") {
                  await Api.pullLatest();
                } else if (window.syncBootstrap) {
                  await syncBootstrap();
                }
                render();
              }, 1200);
            } else {
              resDiv.innerHTML = `
                <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:12px;color:#991B1B">
                  <b>فشل الاستيراد:</b> ${data.error || "حدث خطأ أثناء معالجة الملف"}
                </div>
              `;
              importBtn.disabled = false;
              importBtn.textContent = "🚀 بدء الاستيراد";
            }
          }
        } catch (err) {
          toast("خطأ في الاتصال بالخادم: " + err.message, "warn");
          importBtn.disabled = false;
          importBtn.textContent = "🚀 بدء الاستيراد";
        }
      };
      reader.readAsDataURL(selectedPlotsFile);
    };
  }
}

function initInvestorsImport() {
  const fileInput = document.getElementById("investors-file-input");
  if (!fileInput) return;
  const fileDiv = document.getElementById("investors-selected-file");
  const importBtn = document.getElementById("btn-do-investors-import");
  const resDiv = document.getElementById("investors-import-result");
  const dropZone = document.getElementById("investors-drop-zone");
  const pickBtn = document.getElementById("btn-pick-investors-file");

  let selectedInvestorsFile = null;

  const handleInvestorsFile = (file) => {
    if (!file) return;
    selectedInvestorsFile = file;
    if (fileDiv) {
      fileDiv.innerHTML = `
        <div style="background:#F0FDF4;border:1px solid #86EFAC;color:#166534;padding:8px 14px;border-radius:8px;display:inline-flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;box-shadow:0 1px 2px rgba(0,0,0,0.05)">
          <span style="font-size:16px">📄</span>
          <b>${escapeHtml(file.name)}</b>
          <span style="font-size:11px;color:#15803D">(${(file.size / 1024).toFixed(1)} كيلوبايت)</span>
          <span style="color:#16A34A;font-size:14px">✓</span>
        </div>
      `;
    }
    if (importBtn) {
      importBtn.disabled = false;
      importBtn.style.cursor = "pointer";
      importBtn.style.opacity = "1";
      importBtn.style.pointerEvents = "auto";
    }
  };

  if (pickBtn) {
    pickBtn.onclick = (e) => {
      e.stopPropagation();
      fileInput.click();
    };
  }

  if (dropZone) {
    dropZone.onclick = (e) => {
      if (e.target !== fileInput) {
        fileInput.click();
      }
    };
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = "#0284C7"; dropZone.style.background = "#F0F9FF"; };
    dropZone.ondragleave = () => { dropZone.style.borderColor = "#CBD5E1"; dropZone.style.background = "#F8FAFC"; };
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "#CBD5E1";
      dropZone.style.background = "#F8FAFC";
      const file = e.dataTransfer?.files?.[0];
      handleInvestorsFile(file);
    };
  }

  fileInput.onclick = (e) => {
    e.stopPropagation();
    e.target.value = null;
  };

  fileInput.onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    handleInvestorsFile(file);
  };

  if (importBtn) {
    importBtn.onclick = async () => {
      if (!selectedInvestorsFile) {
        toast("يرجى اختيار ملف الإكسل أولاً", "warn");
        return;
      }
      importBtn.disabled = true;
      importBtn.textContent = "جاري التحليل واستيراد المستثمرين والعقود...";
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const base64 = ev.target.result;
          const resp = await fetch("/api/investors/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ base64, filename: selectedInvestorsFile.name })
          });
          const data = await resp.json();
          if (resDiv) {
            resDiv.style.display = "block";
            if (data.success) {
              resDiv.innerHTML = `
                <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:12px;color:#065F46">
                  <div style="font-weight:bold;font-size:14px">🎉 تم الاستيراد بنجاح!</div>
                  <div style="font-size:12px;margin-top:4px">
                    تم استيراد/تحديث <b>${data.importedInvestors}</b> مستثمر، و <b>${data.importedContracts}</b> عقد استثماري، وربط <b>${data.linkedPlots}</b> قطعة أرضية.
                  </div>
                </div>
              `;
              toast(`تم استيراد ${data.importedInvestors} مستثمر و ${data.importedContracts} عقد بنجاح!`);
              setTimeout(async () => {
                showInvestorImportModal = false;
                if (typeof Api !== "undefined" && typeof Api.pullLatest === "function") {
                  await Api.pullLatest();
                } else if (window.syncBootstrap) {
                  await syncBootstrap();
                }
                render();
              }, 1400);
            } else {
              resDiv.innerHTML = `
                <div style="background:#FEF2F2;border:1px solid #FECACA;border-radius:10px;padding:12px;color:#991B1B">
                  <b>فشل الاستيراد:</b> ${data.error || "حدث خطأ أثناء معالجة الملف"}
                </div>
              `;
              importBtn.disabled = false;
              importBtn.textContent = "🚀 بدء الاستيراد";
            }
          }
        } catch (err) {
          toast("خطأ في الاتصال بالخادم: " + err.message, "warn");
          importBtn.disabled = false;
          importBtn.textContent = "🚀 بدء الاستيراد";
        }
      };
      reader.readAsDataURL(selectedInvestorsFile);
    };
  }
}

function initSeedlingsImport() {
  const fileInput = document.getElementById("seedlings-file-input");
  if (!fileInput) return;
  const fileDiv = document.getElementById("seedlings-selected-file");
  const importBtn = document.getElementById("btn-do-seedlings-import");
  const resDiv = document.getElementById("seedlings-import-result");
  const dropZone = document.getElementById("seedlings-drop-zone");
  const pickBtn = document.getElementById("btn-pick-seedlings-file");

  const parseSeedlingsFile = (file) => {
    if (!file) return;
    if (typeof XLSX === "undefined") {
      toast("تعذر العثور على مكتبة الإكسل لقراءة الملف", "warn");
      return;
    }
    selectedSeedlingsFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const parsed = [];
        const startIdx = (rows.length > 0 && typeof rows[0][0] === "string" && (rows[0][0].includes("المحصول") || rows[0][1]?.includes("الصنف"))) ? 1 : 0;

        for (let i = startIdx; i < rows.length; i++) {
          const r = rows[i];
          if (!r || r.length === 0 || (!r[0] && !r[1])) continue;

          const cropStr = String(r[0] || "").trim().toLowerCase();
          const cropId = (cropStr.includes("زيتون") || cropStr.includes("olive")) ? "olive" : "palm";

          const variety = String(r[1] || "").trim() || (cropId === "olive" ? "بيكوال" : "مجدول");
          const qty = Math.max(1, parseInt(r[2]) || 1);

          const srcStr = String(r[3] || "").trim();
          let source = "offshoot";
          let sourceName = "فسيلة";
          if (srcStr.includes("عقل") || srcStr.includes("cutting")) {
            source = "cutting";
            sourceName = "عقلة خضرية";
          } else if (srcStr.includes("نسيج") || srcStr.includes("tissue")) {
            source = "tissue";
            sourceName = "زراعة أنسجة";
          } else if (srcStr.includes("بذر") || srcStr.includes("seed")) {
            source = "seed";
            sourceName = "بذور";
          } else if (srcStr) {
            sourceName = srcStr;
          }

          const supplier = String(r[4] || "").trim() || "توريد مشتل";

          let dateVal = "";
          if (typeof r[5] === "number") {
            try {
              dateVal = new Date(Math.round((r[5] - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
            } catch(e) {}
          } else if (r[5]) {
            dateVal = String(r[5]).trim();
          }
          if (!dateVal || dateVal.length < 8) dateVal = new Date().toISOString().slice(0, 10);

          const location = String(r[6] || "").trim();

          const stageStr = String(r[7] || "").trim();
          let stage = "inbound";
          let stageLabel = "الوارد والتوريد";
          if (stageStr.includes("صرف") || stageStr.includes("جاهز") || stageStr.includes("ready")) {
            stage = "ready";
            stageLabel = "جاهزة للصرف";
          } else if (stageStr.includes("جذر") || stageStr.includes("رعاية") || stageStr.includes("rooting") || stageStr.includes("تحضين")) {
            stage = "rooting";
            stageLabel = "التجذير والرعاية";
          }

          const cost = parseFloat(r[8]) || 0;
          const notes = String(r[9] || "").trim();

          parsed.push({
            cropId,
            variety,
            qty,
            source,
            sourceName,
            supplier,
            date: dateVal,
            location,
            stage,
            stageLabel,
            cost,
            notes
          });
        }

        if (parsed.length === 0) {
          toast("لم يتم العثور على أي صفوف صالحة للشتلات في الملف", "warn");
          return;
        }

        parsedSeedlingsData = parsed;
        toast(`تمت قراءة ${parsed.length} بند بنجاح من ملف الإكسل`);
        render();
      } catch (err) {
        console.error("Error parsing seedlings excel:", err);
        toast("خطأ أثناء قراءة ملف الإكسل: " + err.message, "warn");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  if (pickBtn) {
    pickBtn.onclick = (e) => {
      e.stopPropagation();
      fileInput.click();
    };
  }

  if (dropZone) {
    dropZone.onclick = (e) => {
      if (e.target !== fileInput) {
        fileInput.click();
      }
    };
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = "#16A34A"; dropZone.style.background = "#F0FDF4"; };
    dropZone.ondragleave = () => { dropZone.style.borderColor = "#CBD5E1"; dropZone.style.background = "#F8FAFC"; };
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.style.borderColor = "#CBD5E1";
      dropZone.style.background = "#F8FAFC";
      const file = e.dataTransfer?.files?.[0];
      parseSeedlingsFile(file);
    };
  }

  fileInput.onclick = (e) => {
    e.stopPropagation();
    e.target.value = null;
  };

  fileInput.onchange = (e) => {
    const file = e.target.files && e.target.files[0];
    parseSeedlingsFile(file);
  };

  if (importBtn && parsedSeedlingsData.length > 0) {
    importBtn.onclick = async () => {
      importBtn.disabled = true;
      importBtn.textContent = "جاري إنشاء الشتلات وتسجيلها...";

      try {
        const st = Store.get();
        const createdList = [];
        const nowStr = new Date().toISOString();

        for (const item of parsedSeedlingsData) {
          const count = Math.max(1, parseInt(item.qty) || 1);
          const cropId = item.cropId || "palm";
          const variety = item.variety || (cropId === "olive" ? "بيكوال" : "مجدول");
          const cropCode = cropId === "olive" ? "OLV" : "PLM";
          const varShort = (variety || "VAR").replace(/\s+/g, "").slice(0, 3).toUpperCase();
          const initialStage = item.stage || "inbound";
          const stageDesc = item.stageLabel || (initialStage === "inbound" ? "الوارد والتوريد" : (initialStage === "rooting" ? "في التجذير والرعاية" : "جاهزة للصرف"));

          for (let i = 1; i <= count; i++) {
            const curSeq = (st.offshoots ? st.offshoots.length : 0) + createdList.length + 1;
            const seqStr = `OS${String(curSeq).padStart(3, "0")}`;
            const dateTag = (item.date || nowStr.slice(0, 10)).replace(/-/g, "").slice(2, 6);
            const code = `NUR-${cropCode}-${varShort}-${seqStr}-${dateTag}`;
            const offshootId = `os_${Date.now()}_${createdList.length}_${Math.random().toString(36).slice(2, 6)}`;

            const offshootObj = {
              id: offshootId,
              motherId: null,
              motherCode: null,
              tempCode: code,
              seq: String(curSeq).padStart(3, "0"),
              date: item.date || nowStr.slice(0, 10),
              variety: variety,
              originType: "purchase",
              originLabel: item.sourceName || "شراء / توريد إكسل",
              supplier: item.supplier || "توريد مشتل",
              nsStatus: initialStage,
              statusDesc: stageDesc,
              is_opening_stock: 1,
              isOpeningStock: 1,
              health: "healthy",
              cropId: cropId,
              source: item.source || "offshoot",
              location: item.location || "",
              cost: Number(item.cost) || 0,
              notes: item.notes || "استيراد ملف إكسل",
              createdAt: nowStr
            };
            createdList.push(offshootObj);
          }
        }

        st.offshoots = st.offshoots || [];
        st.offshoots.unshift(...createdList);
        Store.set({ offshoots: st.offshoots });

        if (typeof Api !== "undefined" && typeof Api.bulkIntakeOffshoots === "function") {
          await Api.bulkIntakeOffshoots(createdList);
        }

        if (typeof AuditLog !== "undefined") {
          AuditLog.log({
            action: "bulk_import",
            module: "nursery",
            severity: "info",
            title: `استيراد مجمع للشتلات: ${createdList.length} شتلة`,
            summary: `تم استيراد ${createdList.length} شتلة من ملف إكسل بنجاح`,
            details: { count: createdList.length, filename: selectedSeedlingsFileName },
            targetType: "nursery",
            user: session()?.name || "مستخدم",
            role: session()?.role || "admin"
          });
        }

        if (resDiv) {
          resDiv.style.display = "block";
          resDiv.innerHTML = `
            <div style="background:#ECFDF5;border:1px solid #A7F3D0;border-radius:10px;padding:12px;color:#065F46">
              <div style="font-weight:bold;font-size:14px">🎉 تم استيراد وتوريد الشتلات بنجاح!</div>
              <div style="font-size:12px;margin-top:4px">
                تم إنشاء وتسجيل <b>${createdList.length}</b> شتلة/فسيلة جديدة في قاعدة البيانات وإضافتها لمسارات المشتل.
              </div>
            </div>
          `;
        }

        toast(`🎉 تم استيراد ${createdList.length} شتلة بنجاح!`);
        setTimeout(async () => {
          showSeedlingImportModal = false;
          parsedSeedlingsData = [];
          selectedSeedlingsFileName = "";
          if (typeof Api !== "undefined" && typeof Api.pullLatest === "function") {
            await Api.pullLatest();
          } else if (window.syncBootstrap) {
            await syncBootstrap();
          }
          render();
        }, 1400);

      } catch (err) {
        console.error("Error during seedlings import:", err);
        toast("حدث خطأ أثناء الاستيراد: " + err.message, "warn");
        importBtn.disabled = false;
        importBtn.textContent = "🚀 بدء استيراد الشتلات";
      }
    };
  }
}

function initGis() {
  if (typeof L === "undefined") return;
  const farmMapEl = $("#farmmap");
  const editMapEl = $("#editmap");
  if (!farmMapEl && !editMapEl) return;
  const st = Store.get();

  if (farmMapEl) {
    if (window._currentFarmMap) {
      try { window._currentFarmMap.remove(); } catch(e){}
      window._currentFarmMap = null;
    }
    if (farmMapEl._leaflet_id) {
      farmMapEl._leaflet_id = null;
    }

    const scope = (current === "inv-home" || current === "inv-palms") ? investorPalms() : st.palms;
    const _mapPlotFamily = new Set(mapPlot ? plotFamilyIds(mapPlot) : []);
    const _plotSector = new Map(st.plots.map(x => [x.id, x.sector]));
    const palms = scope.filter(p => {
      if (mapCrop && p.cropId !== mapCrop) return false;
      if (mapSec && _plotSector.get(p.plot) !== mapSec) return false;
      if (mapPlot && !_mapPlotFamily.has(p.plot)) return false;
      if (mapVar && p.variety !== mapVar) return false;
      if (mapSt === "sick") {
        const isSick = (p.statusId === 2 || p.statusId === 3 || p.statusCode === "observation" || p.statusCode === "infected" || p.status === "تحت المراقبة" || (p.status||"").includes("سوسة") || (p.status||"").includes("مصاب") || (p.status||"").includes("مراقبة"));
        if (!isSick) return false;
      }
      if (mapQ && !p.code.toUpperCase().includes(mapQ.toUpperCase())) return false;
      return !p.archived;
    });

    const first = palms[0] ? palmLatLng(palms[0]) : [27.05, 31.16];
    const hasExplicitFilter = Boolean(mapQ || mapSec || mapPlot || mapVar || (mapSt && mapSt !== "all") || mapCrop);
    const initialCenter = (!hasExplicitFilter && window._lastGisCenter) ? window._lastGisCenter : first;
    const initialZoom = (!hasExplicitFilter && window._lastGisZoom) ? window._lastGisZoom : (mapQ ? 18 : 14);

    const map = L.map("farmmap").setView(initialCenter, initialZoom);
    window._currentFarmMap = map;

    // Track user movements so subsequent renders preserve user focus
    map.on("moveend", () => {
      try {
        window._lastGisCenter = map.getCenter();
        window._lastGisZoom = map.getZoom();
      } catch (e) {}
    });

    // Basemaps: Street + High-Resolution Satellite
    // maxNativeZoom: 18 prevents Esri from showing "Map data not yet available" placeholders by smoothly upscaling zoom 18
    const satLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
      maxNativeZoom: 18,
      maxZoom: 22,
      attribution: "Esri World Imagery"
    });
    const googleSatLayer = L.tileLayer("https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}", {
      maxNativeZoom: 20,
      maxZoom: 22,
      attribution: "Google Satellite (Hybrid)"
    });
    const osmLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "OpenStreetMap"
    });

    satLayer.addTo(map);
    try {
      L.control.layers({
        "🛰️ قمر صناعي (Esri)": satLayer,
        "🌍 قمر صناعي هجين (Google)": googleSatLayer,
        "🗺️ خريطة الشوارع (OSM)": osmLayer
      }, null, { position: "topleft" }).addTo(map);
    } catch(e){}

    // One shared canvas for boundaries and trees: Leaflet hit-tests the last-drawn shape first, so a tree
    // drawn over a plot gets the click (with separate SVG/canvas layers the plot polygon swallowed it).
    const canvasRenderer = (typeof L !== "undefined" && L.canvas) ? L.canvas({ padding: 0.5 }) : null;

    // 1. Render Sector Boundaries
    const visibleSectors = mapSec ? st.sectors.filter(s => s.id === mapSec) : st.sectors;
    visibleSectors.forEach(sec => {
      if (sec.boundaryCoordinates && Array.isArray(sec.boundaryCoordinates) && sec.boundaryCoordinates.length >= 3) {
        const secPoly = L.polygon(sec.boundaryCoordinates, {
          renderer: canvasRenderer || undefined,
          color: "#d97706",
          weight: 3,
          dashArray: "8, 6",
          fillColor: "#fef3c7",
          fillOpacity: 0.05
        }).addTo(map);

        const secPlotsCount = st.plots.filter(pl => pl.sector === sec.id).length;
        const secPalmsCount = (_s => st.palms.filter(p => _s.has(p.plot)))(new Set(st.plots.filter(pl => pl.sector === sec.id).map(pl => pl.id))).length;

        secPoly.bindPopup(`
          <div class="map-popup-card">
            <div style="font-size:15px;font-weight:bold;color:#b45309;margin-bottom:6px">🚩 ${sec.name}</div>
            <div><b>المساحة الإجمالية:</b> <span class="chip chip-gold">${sec.totalArea || 0} فدان</span></div>
            <div><b>عدد القطع:</b> ${secPlotsCount} قطعة</div>
            <div><b>إجمالي النخيل:</b> ${secPalmsCount} نخلة</div>
          </div>
        `);
      }
    });

    // 2. Render Plot Boundaries
    let focusedPolygon = null;
    const visiblePlots = st.plots.filter(pl => {
      if (mapSec && pl.sector !== mapSec) return false;
      if (mapPlot && pl.id !== mapPlot) return false;
      return true;
    });

    visiblePlots.forEach(pl => {
      if (pl.boundaryCoordinates && Array.isArray(pl.boundaryCoordinates) && pl.boundaryCoordinates.length >= 3) {
        const isChild = Boolean(pl.parentPlotId);
        const isSelected = (mapPlot === pl.id) || (mapQ && (pl.id.toUpperCase().includes(mapQ.toUpperCase()) || pl.name.toUpperCase().includes(mapQ.toUpperCase())));

        const polyStyle = isSelected ? {
          color: "#f59e0b",
          weight: 4,
          fillColor: "#fbbf24",
          fillOpacity: 0.35,
          dashArray: null
        } : {
          color: isChild ? "#0284c7" : "#15803d",
          weight: 2,
          fillColor: isChild ? "#38bdf8" : "#22c55e",
          fillOpacity: 0.16,
          dashArray: isChild ? "5, 5" : null
        };

        const poly = L.polygon(pl.boundaryCoordinates, { ...polyStyle, renderer: canvasRenderer || undefined }).addTo(map);

        const plotPalms = activePalmsInPlotFamily(pl.id);
        const density = (pl.areaValue && pl.areaValue > 0) ? (plotPalms.length / pl.areaValue).toFixed(1) : "—";
        const parentPlotObj = pl.parentPlotId ? st.plots.find(x => x.id === pl.parentPlotId) : null;
        const subPlots = st.plots.filter(x => x.parentPlotId === pl.id);

        let hierarchyHtml = "";
        if (parentPlotObj) {
          hierarchyHtml = `<div style="font-size:12px;color:#0284c7;margin:4px 0">🔹 قطعة فرعية تابعة للأم: <b>${parentPlotObj.name}</b></div>`;
        } else if (subPlots.length > 0) {
          hierarchyHtml = `<div style="font-size:12px;color:#059669;margin:4px 0">🌿 قطعة رئيسية تضم ${subPlots.length} قطع تابعة (${subPlots.map(sp=>sp.name).join("، ")})</div>`;
        }

        poly.bindPopup(`
          <div class="map-popup-card">
            <div style="font-size:15px;font-weight:bold;margin-bottom:4px">
              📍 ${pl.name} <span class="chip" style="font-size:11px">${pl.id}</span>
            </div>
            ${hierarchyHtml}
            <div style="display:flex;gap:6px;margin:6px 0;flex-wrap:wrap">
              <span class="chip" style="background:#e0f2fe;color:#0369a1;font-weight:bold">📐 ${pl.areaValue || 0} ${pl.areaUnit || 'فدان'}</span>
              <span class="chip" style="background:#f0fdf4;color:#15803d;font-weight:bold">🌴 ${plotPalms.length} شجرة</span>
              <span class="chip" style="background:#fef3c7;color:#92400e">⚡ ${density} نخلة/فدان</span>
            </div>
            ${pl.mainCrop ? `<div><b>المحصول:</b> ${pl.mainCrop}</div>` : ""}
            ${pl.irrigationSource ? `<div><b>مصدر الري:</b> ${pl.irrigationSource}</div>` : ""}
            ${pl.contractRef ? `<div><b>رقم العقد:</b> <a href="javascript:void(0)" onclick="event.preventDefault();window.openInvestorContractByPlot('${pl.id}', '${pl.contractRef}')" style="color:#0284C7;text-decoration:underline;font-weight:700" title="تعديل بيانات العقد والمستثمر">📜 ${pl.contractRef} (تعديل العقد ✏️)</a></div>` : `<div><a href="javascript:void(0)" onclick="event.preventDefault();window.openEditPlotModal('${pl.id}')" style="color:#0284C7;font-size:12px">+ تخصيص لعقد استثماري</a></div>`}
            <div class="map-popup-btns" style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap">
              <button class="map-popup-btn map-popup-btn-primary" onclick="event.preventDefault();window._gisFocusPlot&&_gisFocusPlot('${pl.id}')">🔍 تركيز</button>
              <button class="map-popup-btn map-popup-btn-ghost" onclick="event.preventDefault();go('plot','${pl.id}')">🌴 تفاصيل</button>
              ${hasPerm("plots_manage") ? `<button class="map-popup-btn" style="background:#fef3c7;color:#92400e;border:1px solid #f59e0b;font-weight:700" onclick="event.preventDefault();window.openEditPlotModal('${pl.id}')">✏️ تعديل القطعة</button>` : ''}
              ${hasPerm("plots_export") ? `<button class="map-popup-btn" style="background:#EFF6FF;color:#1D4ED8;border:1px solid #93C5FD;font-weight:700" onclick="event.preventDefault();window.exportPlotPalmsRoundTrip('${pl.id}')" title="تصدير شيت النخيل بصيغة مطابقة للاستيراد للتعديل">📥 تصدير للتعديل</button>` : ''}
              ${hasPerm("plots_gps_clear") ? `<button class="map-popup-btn" style="background:#FEF2F2;color:#B91C1C;border:1px solid #FCA5A5;font-weight:700" onclick="event.preventDefault();window.clearPlotGps('${pl.id}')" title="تفريغ إحداثيات أشجار هذه القطعة">🗑️ تفريغ الإحداثيات</button>` : ''}
            </div>
          </div>
        `);

        if (isSelected) {
          focusedPolygon = poly;
        }
      }
    });

    if (focusedPolygon) {
      try {
        map.fitBounds(focusedPolygon.getBounds(), { padding: [50, 50] });
        focusedPolygon.openPopup();
      } catch(e){}
    }

    const plotsMap = new Map((st.plots || []).map(x => [x.id, x]));
    const sourcesMap = new Map(((st.propagationSourceTypes || [])).map(s => [s.code, s.name]));

    // 3. Render Palms with High-Performance Dynamic Capping & Lazy Boundary Verification
    let renderPalmsList = palms;
    const isFiltered = Boolean(mapPlot || mapQ || mapVar || (mapSt && mapSt !== "all"));
    const MAX_PALM_MARKERS = 1800;

    if (!isFiltered && renderPalmsList.length > MAX_PALM_MARKERS) {
      const sickOrObs = [];
      const regular = [];
      for (const p of renderPalmsList) {
        if (p.statusId === 3 || p.statusId === 2 || (p.status||"").includes("سوسة") || (p.status||"").includes("مراقبة")) {
          sickOrObs.push(p);
        } else if (regular.length < MAX_PALM_MARKERS) {
          regular.push(p);
        }
      }
      renderPalmsList = sickOrObs.concat(regular).slice(0, MAX_PALM_MARKERS);
    }

    const palmMarkers = [];
    renderPalmsList.forEach(p => {
      const ll = palmLatLng(p);
      const isOlive = p.cropId === "olive";
      const srcName = sourcesMap.get(p.source) || p.source || "—";
      const cropL = cropSingle(p.cropId);
      const icon = cropIcon(p.cropId, 16);

      const plotObj = plotsMap.get(p.plot);
      const isSick = (p.statusId === 3 || p.statusCode === "infected" || (p.status||"").includes("سوسة") || (p.status||"").includes("مصاب"));
      const isObs = (p.statusId === 2 || p.statusCode === "observation" || p.status === "تحت المراقبة" || (p.status||"").includes("مراقبة"));
      const pColor = palmColor(p);

      const marker = L.circleMarker(ll, {
        renderer: canvasRenderer,
        radius: isSick ? 9.5 : (isObs ? 8.5 : (isOlive ? 8 : 7)),
        color: isSick ? "#7F1D1D" : (isObs ? "#78350F" : (isOlive ? "#33691E" : pColor)),
        fillColor: pColor,
        fillOpacity: (isSick || isObs) ? 1.0 : .9,
        weight: (isSick || isObs) ? 3 : (isOlive ? 2.5 : 1)
      });

      marker.bindPopup(() => {
        let isOutOfBounds = false;
        if (plotObj && plotObj.boundaryCoordinates && Array.isArray(plotObj.boundaryCoordinates) && plotObj.boundaryCoordinates.length >= 3) {
          isOutOfBounds = !isPointInPolygon(ll, plotObj.boundaryCoordinates);
        }
        return `
        <div class="map-popup-card">
          ${isOutOfBounds ? `<div style="background:#fee2e2;color:#b91c1c;padding:4px 8px;border-radius:4px;font-size:11px;margin-bottom:6px;font-weight:bold">⚠️ تنبيه GIS: إحداثيات الشجرة تقع خارج حدود القطعة (${plotObj ? plotObj.name : p.plot})!</div>` : ""}
          <div style="font-size:15px;font-weight:bold;margin-bottom:4px;display:flex;align-items:center;gap:4px">
            ${icon} <span dir="ltr">${p.code}</span>
          </div>
          <div><b>${cropL}:</b> <b>${p.variety}</b></div>
          <div>المصدر: <span class="chip" style="font-size:11px">${p.source || '—'}: ${srcName}</span></div>
          <div>الحالة: <b>${p.status}</b> • ${plotName(p.plot)}</div>
          <div class="map-popup-btns">
            <a href="#" class="map-popup-btn map-popup-btn-ghost" onclick="event.preventDefault();window._gisGo&&_gisGo('palm','${p.id}')">بطاقة الشجرة</a>
            ${hasPerm("ops_record") ? `<a href="#" class="map-popup-btn map-popup-btn-primary" onclick="event.preventDefault();window._gisGo&&_gisGo('op','${p.id}')">تسجيل عملية</a>` : ""}
          </div>
        </div>
      `;
      });

      palmMarkers.push(marker);
    });

    if (palmMarkers.length > 0) {
      L.featureGroup(palmMarkers).addTo(map);
    }

    if (mapQ && palms[0] && !focusedPolygon) map.setView(palmLatLng(palms[0]), 18);

    window._gisGo = (n, id) => {
      if (session().role === "investor") return go("inv-palm", id);
      if (n === "op" && !hasPerm("ops_record")) return toast("ليس لديك صلاحية تسجيل عمليات ميدانية");
      go(n==="op"?"op":"palm", id);
    };

    window._gisFocusPlot = (plotId) => {
      mapPlot = plotId;
      const select = document.getElementById("gisplot");
      if (select) select.value = plotId;
      render();
    };
  }

  if (editMapEl) {
    if (window._currentEditMap) {
      try { window._currentEditMap.remove(); } catch(e){}
      window._currentEditMap = null;
    }
    if (editMapEl._leaflet_id) {
      editMapEl._leaflet_id = null;
    }
    const lat = parseFloat($("#elat")?.value) || 27.05;
    const lng = parseFloat($("#elng")?.value) || 31.16;
    try {
      const map = L.map("editmap").setView([lat, lng], 17);
      window._currentEditMap = map;
      const satEdit = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxNativeZoom: 18, maxZoom: 22, attribution: "Esri" });
      const osmEdit = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 });
      satEdit.addTo(map);
      try {
        L.control.layers({ "🛰️ قمر صناعي": satEdit, "🗺️ خريطة": osmEdit }, null, { position: "topright" }).addTo(map);
      } catch(e){}
      const mk = L.marker([lat, lng], { draggable: true }).addTo(map);
      window._currentEditMarker = mk;
      mk.on("dragend", () => {
        const p = mk.getLatLng();
        if ($("#elat")) $("#elat").value = p.lat.toFixed(6);
        if ($("#elng")) $("#elng").value = p.lng.toFixed(6);
      });
      map.on("click", e => {
        mk.setLatLng(e.latlng);
        if ($("#elat")) $("#elat").value = e.latlng.lat.toFixed(6);
        if ($("#elng")) $("#elng").value = e.latlng.lng.toFixed(6);
      });
      const syncFromInputs = () => {
        const la = parseFloat($("#elat")?.value);
        const lo = parseFloat($("#elng")?.value);
        if (!isNaN(la) && !isNaN(lo)) {
          mk.setLatLng([la, lo]);
          map.panTo([la, lo]);
        }
      };
      $("#elat")?.addEventListener("input", syncFromInputs);
      $("#elng")?.addEventListener("input", syncFromInputs);
      setTimeout(() => { map.invalidateSize(); }, 200);
    } catch (e) {
      console.warn("Edit map init error:", e);
    }
  }
}
function bind() {
  if (!window._dashDndBound) {
    window._dashDndBound = true;
    let draggedWidgetId = null;

    document.addEventListener("dragstart", (e) => {
      const widget = e.target.closest(".dash-widget");
      if (!widget) return;
      draggedWidgetId = widget.dataset.widgetId;
      if (e.dataTransfer) {
        e.dataTransfer.setData("text/plain", draggedWidgetId);
        e.dataTransfer.effectAllowed = "move";
      }
      widget.classList.add("is-dragging");
    });

    document.addEventListener("dragover", (e) => {
      const targetWidget = e.target.closest(".dash-widget");
      if (!targetWidget || !draggedWidgetId) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }
      targetWidget.classList.add("drag-over");
    });

    document.addEventListener("dragleave", (e) => {
      const targetWidget = e.target.closest(".dash-widget");
      if (targetWidget) {
        targetWidget.classList.remove("drag-over");
      }
    });

    document.addEventListener("drop", (e) => {
      const targetWidget = e.target.closest(".dash-widget");
      if (!targetWidget || !draggedWidgetId) return;
      e.preventDefault();
      targetWidget.classList.remove("drag-over");
      const targetId = targetWidget.dataset.widgetId;
      if (targetId && targetId !== draggedWidgetId) {
        const order = getDashWidgetsOrder();
        const fromIdx = order.indexOf(draggedWidgetId);
        const toIdx = order.indexOf(targetId);
        if (fromIdx !== -1 && toIdx !== -1) {
          order.splice(fromIdx, 1);
          order.splice(toIdx, 0, draggedWidgetId);
          setDashWidgetsOrder(order);
          render();
        }
      }
    });

    document.addEventListener("dragend", () => {
      draggedWidgetId = null;
      document.querySelectorAll(".dash-widget").forEach(w => {
        w.classList.remove("is-dragging", "drag-over");
      });
    });
  }

  if (!window._palmClick) {
    window._palmClick = true;
    document.addEventListener("click", async (e) => {
      // Close active user action dropdown menu if clicking outside
      if (activeUserMenuId && !e.target.closest(".action-menu-wrap")) {
        activeUserMenuId = null;
        render();
      }
      if (isTopUserMenuOpen && !e.target.closest(".topbar-user-menu-wrap")) {
        isTopUserMenuOpen = false;
        render();
      }

      // If clicking inside or on any form controls, allow native behavior undisturbed
      if (e.target.closest("select, input, textarea, option, optgroup, label")) {
        const actEl = e.target.closest("[data-act]");
        if (!actEl || (actEl.tagName !== "BUTTON" && actEl.tagName !== "A")) {
          return;
        }
      }
      const fill = e.target.closest("[data-fill]");
      if (fill) { const u = $("#user"); if (u) u.value = fill.dataset.fill; return; }
      const actEl = e.target.closest("[data-act]");
      if (actEl) {
        if (actEl.classList.contains("custom-modal-backdrop") && e.target !== actEl) {
          return;
        }
        if (actEl.tagName === "SELECT" || actEl.tagName === "INPUT" || actEl.tagName === "TEXTAREA" || e.target.tagName === "SELECT" || e.target.tagName === "OPTION") {
          return;
        }
        e.preventDefault(); e.stopPropagation(); act(actEl.dataset.act, actEl.dataset.id, actEl); return;
      }
      const goEl = e.target.closest("[data-go]");
      if (goEl) { e.preventDefault(); e.stopPropagation(); go(goEl.dataset.go, goEl.dataset.id); }
    });
    document.addEventListener("change", (e) => {
      // Handle avatar file inputs
      if (e.target && e.target.type === "file" && e.target.classList.contains("avatar-file-input")) {
        const file = e.target.files && e.target.files[0];
        if (file) {
          compressImage(file).then(dataUrl => {
            const prevId = e.target.dataset.prev;
            const valId = e.target.dataset.val;
            if (prevId && $(`#${prevId}`)) {
              $(`#${prevId}`).innerHTML = `<img src="${dataUrl}" alt="Avatar" />`;
            }
            if (valId && $(`#${valId}`)) {
              $(`#${valId}`).value = dataUrl;
            }
            toast("📷 تم تحميل وضغط الصورة بنجاح");
          }).catch(err => {
            console.error("Avatar compression error:", err);
            toast("⚠️ تعذر تحميل الصورة");
          });
        }
        return;
      }
      const actEl = e.target.closest("[data-act]");
      if (actEl && (actEl.tagName === "SELECT" || actEl.tagName === "INPUT")) {
        act(actEl.dataset.act, actEl.value !== undefined ? actEl.value : actEl.dataset.id, actEl);
      }
    });
    document.addEventListener("input", (e) => {
      if (e.target && e.target.id === "bplot_search") {
        bulkPlotSearch = e.target.value;
        const st = Store.get();
        const plots = scopedFieldPlots();
        const matchingPlots = plots.filter(p => {
          if (bulkPlotSec && p.sector !== bulkPlotSec) return false;
          if (bulkPlotSearch) {
            const q = bulkPlotSearch.trim().toLowerCase();
            const full = ((p.name||"") + " " + (p.id||"")).toLowerCase();
            if (!full.includes(q)) return false;
          }
          return true;
        });
        const sel = $("#bplotadd");
        if (sel) {
          if (matchingPlots.length) {
            sel.innerHTML = matchingPlots.map(p => {
              const plPalms = activePalmsInPlot(p.id);
              const pCnt = plPalms.filter(x => (x.cropId||"palm") === "palm").length;
              const oCnt = plPalms.filter(x => x.cropId === "olive").length;
              const plDesc = (pCnt && oCnt) ? `${pCnt} نخيل • ${oCnt} زيتون` : `${plPalms.length} شجرة`;
              return `<option value="${p.id}">${p.name} — ${p.id} (${plDesc})</option>`;
            }).join("");
          } else {
            sel.innerHTML = `<option value="" disabled selected>لا توجد قطع مطابقة للبحث</option>`;
          }
        }
        const btnAll = document.querySelector('[data-act="bplot-add-all"]');
        if (btnAll) {
          btnAll.textContent = `➕ إضافة كل النتائج المطابقة (${matchingPlots.length} قطعة)`;
          btnAll.style.display = matchingPlots.length > 1 ? "" : "none";
        }
      }
      if (e.target && e.target.id === "sch_plot_search") {
        schPlotSearch = e.target.value;
        const st = Store.get();
        const plots = scopedFieldPlots();
        const curSec = schPlotSec !== "" ? schPlotSec : ($("#sch_sec")?.value || "");
        const matchingPlots = plots.filter(p => {
          if (curSec && curSec !== "all" && p.sector !== curSec) return false;
          if (schPlotSearch) {
            const q = schPlotSearch.trim().toLowerCase();
            const full = ((p.name||"") + " " + (p.id||"")).toLowerCase();
            if (!full.includes(q)) return false;
          }
          return true;
        });
        const sel = $("#sch_plot_add");
        if (sel) {
          if (matchingPlots.length) {
            sel.innerHTML = matchingPlots.map(p => {
              const plPalms = activePalmsInPlot(p.id);
              const pCnt = plPalms.filter(x => (x.cropId||"palm") === "palm").length;
              const oCnt = plPalms.filter(x => x.cropId === "olive").length;
              const plDesc = (pCnt && oCnt) ? `${pCnt} نخيل • ${oCnt} زيتون` : `${plPalms.length} شجرة`;
              return `<option value="${p.id}">${p.name} — ${p.id} (${plDesc})</option>`;
            }).join("");
          } else {
            sel.innerHTML = `<option value="" disabled selected>لا توجد قطع مطابقة للبحث</option>`;
          }
        }
        const btnAll = document.querySelector('[data-act="sch-plot-add-all"]');
        if (btnAll) {
          btnAll.textContent = `➕ إضافة كل النتائج المطابقة (${matchingPlots.length} قطعة)`;
          btnAll.style.display = matchingPlots.length > 1 ? "" : "none";
        }
      }
      if (e.target && e.target.id === "i18n_search") {
        i18nQuery = e.target.value.trim();
        const tbody = $("#i18n_tbody");
        if (tbody) {
          const items = I18n.getStudioItems(i18nEditLang, i18nCat, i18nQuery);
          tbody.innerHTML = items.length === 0 ? `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--muted)">لا توجد مصطلحات مطابقة للبحث أو التصنيف الحالي</td></tr>` : items.map(item => `
            <tr>
              <td><code style="font-size:11px;background:#f3f4f6;padding:2px 6px;border-radius:4px;color:#1e293b">${item.key}</code></td>
              <td><b style="font-size:13px">${item.ar}</b></td>
              <td>
                <input class="i18n-input ${item.isCustom ? 'is-custom' : ''}" data-i18n-key="${item.key}" value="${escapeHtml(item.current)}" dir="${i18nEditLang==='ar'||i18nEditLang==='ur'?'rtl':'ltr'}" placeholder="أدخل الترجمة..." style="width:100%;box-sizing:border-box" />
              </td>
              <td style="text-align:center">
                ${item.isCustom ? `
                  <span class="badge" style="background:#e0f2fe;color:#0369a1;font-size:11px">${t("i18n_status_custom", "تعديل مخصص")}</span>
                ` : item.current ? `
                  <span class="badge" style="background:#dcfce7;color:#15803d;font-size:11px">${t("i18n_status_translated", "مترجم معتمد")}</span>
                ` : `
                  <span class="badge" style="background:#fef2f2;color:#b91c1c;font-size:11px">${t("i18n_status_missing", "بحاجة لترجمة")}</span>
                `}
              </td>
            </tr>
          `).join("");
        }
      }
      if (e.target && e.target.id === "zb_inv_search") {
        updateZakatBatchInvestorsFilter();
      }
      if (e.target && e.target.id === "feed-search-input") {
        feedSearchQuery = e.target.value;
        const normQ = (e.target.value || "").trim().toLowerCase();
        $$(".feed-event-card").forEach(card => {
          const txt = card.textContent.toLowerCase();
          card.style.display = (!normQ || txt.includes(normQ)) ? "flex" : "none";
        });
      }
    });
  }
  if ($("#photos")) $("#photos").onchange = async () => {
    for (const f of $("#photos").files) {
      const src = await compressImage(f);
      const wrap = document.createElement("div");
      wrap.className = "thumb-wrap";
      wrap.innerHTML = `<img class="thumb" src="${src}" /><button type="button" class="thumb-del" onclick="this.parentElement.remove()">×</button>`;
      $("#prev")?.appendChild(wrap);
    }
  };
  initPlotsImport();
  initInvestorsImport();
  initSeedlingsImport();
  initGis();
  if ($("#giscrop")) $("#giscrop").onchange = () => {
    const cVal = $("#giscrop").value;
    mapCrop = cVal;
    const st = Store.get();
    if ($("#gisvar")) {
      const vars = cVal ? (st.cropVarieties||[]).filter(v => v.cropId === cVal).map(v => v.name) : (st.varieties||[]);
      $("#gisvar").innerHTML = `<option value="">كل الأصناف</option>` + vars.map(v => `<option value="${v}">${v}</option>`).join("");
    }
  };
  if ($("#ycrop")) $("#ycrop").onchange = () => {
    const cVal = $("#ycrop").value;
    yieldRegCrop = cVal;
    const st = Store.get();
    if ($("#yvar")) {
      const vars = cVal ? (st.cropVarieties||[]).filter(v => v.cropId === cVal).map(v => v.name) : (st.varieties||[]);
      $("#yvar").innerHTML = `<option value="">الكل</option>` + vars.map(v => `<option value="${v}">${v}</option>`).join("");
    }
    if (window._applyY) window._applyY();
  };
  if ($("#bcrop")) $("#bcrop").onchange = () => {
    const cVal = $("#bcrop").value;
    bulkCrop = cVal;
    const st = Store.get();
    if ($("#btype")) {
      const types = st.operationTypes.filter(t => !cVal || cVal === "all" || t.cropId === "all" || t.cropId === cVal || !t.cropId);
      $("#btype").innerHTML = types.map(t => `<option value="${t.id}">${cropIcon(t.cropId, 14)} ${t.name}</option>`).join("");
      paintMaterialFields($("#btype").value, "#bmatwrap");
    }
  };
  if ($("#zcrop")) $("#zcrop").onchange = () => {
    const cVal = $("#zcrop").value;
    zakatFormCrop = cVal;
    if ($("#tvar")) $("#tvar").innerHTML = varietyOptions("كل الأصناف", cVal);
    if ($("#tkind")) {
      const firstOpt = $("#tkind").options[0];
      if (firstOpt) firstOpt.text = (cVal === "olive" ? "عينية / ثمار أو زيت زيتون" : "عينية / تمور");
    }
  };
  if ($("#opscrop")) $("#opscrop").onchange = () => {
    const cVal = $("#opscrop").value;
    opsCrop = cVal;
    const st = Store.get();
    if ($("#opstype")) {
      const types = st.operationTypes.filter(t => !cVal || t.cropId === "all" || t.cropId === cVal || !t.cropId);
      $("#opstype").innerHTML = `<option value="">كل أنواع العمليات</option>` + types.map(t => `<option value="${t.id}">${cropIcon(t.cropId, 14)} ${t.name}</option>`).join("");
    }
  };
  window._setSchCrop = (v) => { schFilterCrop = v; render(); };
  window._setSchSec = (v) => { schFilterSec = v; render(); };
  window._setSchSt = (v) => { schFilterStatus = v; render(); };
  if ($("#schfcrop")) $("#schfcrop").onchange = () => window._setSchCrop($("#schfcrop").value);
  if ($("#schfsec")) $("#schfsec").onchange = () => window._setSchSec($("#schfsec").value);
  if ($("#schfst")) $("#schfst").onchange = () => window._setSchSt($("#schfst").value);
  if ($("#ncrop_buy")) $("#ncrop_buy").onchange = () => {
    const cVal = $("#ncrop_buy").value;
    buyCropSel = cVal;
    if ($("#nvarn")) $("#nvarn").innerHTML = varietyOptions(null, cVal);
  };
  if ($("#ncrop")) $("#ncrop").onchange = () => act("change-pnew-crop", $("#ncrop").value);
  if ($("#gcrop")) $("#gcrop").onchange = () => { act("change-gencrop", $("#gcrop").value); updateGenCodesPreview("gcrop"); };
  ["gsec", "gsecn", "gplots", "gstart", "gplot_area", "gplot_area_unit", "gparts", "gcount", "gdate", "gsrc", "gvar"].forEach(id => {
    const el = $("#" + id);
    if (el) {
      el.addEventListener("input", () => updateGenCodesPreview(id));
      el.addEventListener("change", () => updateGenCodesPreview(id));
    }
  });
  if ($("#genPreviewBox")) setTimeout(() => updateGenCodesPreview("init"), 20);
  if ($("#fcrop")) $("#fcrop").onchange = () => act("filter-field-crop", $("#fcrop").value);
  const needOpEl = $("#nop_need") || $("#nneed");
  if (needOpEl) needOpEl.onchange = () => {
    const w = $("#nop_kind_wrap") || $("#nkind_wrap");
    if (w) w.style.display = needOpEl.value === "1" ? "block" : "none";
  };
  if ($("#eneed")) $("#eneed").onchange = () => { if ($("#ekind_wrap")) $("#ekind_wrap").style.display = $("#eneed").value === "1" ? "block" : "none"; };
  if ($("#odate") && $("#oseq") && $("#tempcode")) {
    const upd = () => {
      const mother = $("#tempcode")?.getAttribute("data-mother") || document.querySelector(".code-chip")?.textContent;
      if (mother) {
        const base = offshootBaseMotherCode(mother);
        const seqVal = ($("#oseq")?.value || "1").padStart(2, "0");
        const dateVal = $("#odate")?.value || new Date().toISOString().slice(0, 10);
        $("#tempcode").textContent = `${base}-OS${seqVal}-${mmYY(dateVal)}`;
      }
    };
    $("#odate").onchange = $("#oseq").oninput = upd;
  }
  if ($("#ssec")) $("#ssec").onchange = () => cascadeScan("sec");
  if ($("#splot")) $("#splot").onchange = () => cascadeScan("plot");
  if ($("#scan_quick_q")) {
    $("#scan_quick_q").onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        scanQ = $("#scan_quick_q").value.trim();
        scanPage = 1;
        render();
      }
    };
  }
  if ($("#scan_plot_q")) {
    $("#scan_plot_q").onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        scanQ = $("#scan_plot_q").value.trim();
        scanPage = 1;
        render();
      }
    };
  }
  if ($("#cat") && $("#otype")) $("#cat").onchange = () => {
    const types = typesByCat($("#cat").value);
    $("#otype").innerHTML = types.map(t=>`<option value="${t.id}">${t.name}</option>`).join("");
  };
  if ($("#erole")) $("#erole").onchange = () => {
    editRoleId = $("#erole").value;
    const st = Store.get();
    const role = st.roles.find(r => r.id === editRoleId);
    if (!role) return;
    if ($("#rname")) $("#rname").value = role.name || "";
    if ($("#rid")) $("#rid").value = role.id || "";
    if ($("#rdesc")) $("#rdesc").value = role.desc || "";
    if ($("#activeRoleName")) $("#activeRoleName").textContent = role.name || "";
    if ($("#activeRoleCode")) $("#activeRoleCode").textContent = role.id || "";
    $$(".rmx").forEach(c => {
      c.checked = mxChecked(role, c.dataset.s, c.dataset.k);
    });
  };
  if ($("#urole")) $("#urole").onchange = () => {
    const roleId = $("#urole").value;
    const st = Store.get();
    const role = st.roles.find(r => r.id === roleId);
    if (!role) return;
    const isEng = session() && session().role === "engineer";
    $$(".rmx-user").forEach(cb => {
      const s = cb.dataset.s;
      const k = cb.dataset.k;
      const chk = mxChecked(role, s, k);
      const dis = isEng && (k === "d" || k === "a" || s === "users" || s === "settings" || s === "zakat");
      cb.checked = !dis && chk;
      cb.closest(".perm-item")?.classList.toggle("active-perm", cb.checked);
    });
  };
  $$(".mx-col").forEach(box => box.onchange = () => {
    $$(".rmx").forEach(c => { if (c.dataset.k === box.dataset.k) c.checked = box.checked; });
  });
  $$(".mx-row").forEach(box => box.onchange = () => {
    $$(".rmx").forEach(c => { if (c.dataset.s === box.dataset.s) c.checked = box.checked; });
  });
  if ($("#asguser")) $("#asguser").onchange = () => { asgUserId = $("#asguser").value; render(); };
  if ($("#asgq")) $("#asgq").oninput = () => {
    const q = ($("#asgq").value||"").toLowerCase().trim();
    $$(".sec-card").forEach(card => {
      const match = !q || card.textContent.toLowerCase().includes(q);
      card.style.display = match ? "" : "none";
      if (q && match) {
        card.classList.add("open");
      }
    });
  };
  $$(".asgsec").forEach(box => box.onchange = () => {
    const card = box.closest(".sec-card");
    if (!card) return;
    card.querySelectorAll(".asgplot").forEach(c => c.checked = box.checked);
    card.querySelectorAll(".asggrp").forEach(c => c.checked = box.checked);
    renderAsgCount();
  });
  $$(".asggrp").forEach(box => box.onchange = () => {
    const grp = box.closest(".plot-group");
    if (!grp) return;
    grp.querySelectorAll(".asgplot").forEach(c => c.checked = box.checked);
    renderAsgCount();
  });
  $$(".asgplot").forEach(c => c.onchange = () => {
    renderAsgCount();
  });
  if ($("#uall")) $("#uall").onchange = () => $$(".uchk").forEach(c => c.checked = $("#uall").checked);
  if ($("#btype")) {
    $("#btype").onchange = () => paintMaterialFields($("#btype").value, "#bmatwrap");
    paintMaterialFields($("#btype").value, "#bmatwrap");
  }
  if ($("#bphoto_dropzone") && $("#bphoto")) {
    $("#bphoto_dropzone").onclick = (e) => {
      if (e.target.closest("[data-act='bphoto-remove']")) return;
      $("#bphoto").click();
    };
    $("#bphoto").onchange = () => {
      const f = $("#bphoto")?.files?.[0];
      if (f) {
        compressImage(f).then(src => {
          bulkPhotoData = src;
          render();
        });
      }
    };
  }
  if ($("#otype")) paintMaterialFields($("#otype").value, "#omatwrap");
  if ($("#nplotq")) $("#nplotq").onkeydown = e => { if (e.key === "Enter") { nPlotQ = $("#nplotq").value; render(); } };
  if ($("#nhide")) $("#nhide").onchange = () => { nHideEmpty = $("#nhide").checked; nPlotQ = $("#nplotq")?.value || nPlotQ; render(); };
  if ($("#scopeq")) $("#scopeq").oninput = () => { if ($("#scopeadd")) $("#scopeadd").innerHTML = scopeOptionList(); };
  if ($("#nori")) $("#nori").onchange = () => {
    const inn = $("#nori").value === "internal";
    $("#intBox")?.classList.toggle("hidden", !inn);
    $("#buyBox")?.classList.toggle("hidden", inn);
    if ($("#nvar")) $("#nvar").disabled = false;
  };
  if ($("#nsuckerq")) {
    $("#nsuckerq").oninput = $("#nsuckerq").onchange = fillSuckerHint;
  }
  if ($("#nall")) $("#nall").onchange = () => $$(".nchk").forEach(c => c.checked = $("#nall").checked);
  if ($("#bgov")) $("#bgov").onchange = () => {
    const u = Store.get().users.find(x => x.id === session()?.id);
    if (!u || !u.bg || u.bg.type === "default") return;
    u.bg.overlay = +$("#bgov").value;
    Store.set({ users: Store.get().users, session: { ...session(), bg: u.bg } });
    applyUserBg();
  };
  if ($("#pall")) $("#pall").onchange = () => {
    $$(".pchk").forEach(c => {
      c.checked = $("#pall").checked;
      if (c.checked) selectedPalmIds.add(c.value); else selectedPalmIds.delete(c.value);
    });
  };
  $$(".pchk").forEach(c => c.onchange = () => {
    if (c.checked) selectedPalmIds.add(c.value); else selectedPalmIds.delete(c.value);
  });
  if ($("#fsec")) $("#fsec").onchange = () => { browseSec = $("#fsec").value || null; browsePlot = null; palmPage = 1; go("palms"); };
  if ($("#fplot")) $("#fplot").onchange = () => {
    browsePlot = $("#fplot").value || null;
    if (browsePlot) browseSec = Store.get().plots.find(p => p.id === browsePlot)?.sector || browseSec;
    palmPage = 1; go("palms");
  };
  if ($("#palmsearch")) $("#palmsearch").oninput = () => {
    palmQ = $("#palmsearch").value; palmPage = 1; render();
  };
  if ($("#palm_pagesize")) {
    $("#palm_pagesize").onchange = () => {
      const val = $("#palm_pagesize").value;
      const num = parseInt(val, 10);
      PAGE = isNaN(num) ? 20 : num;
      try { localStorage.setItem("palmPageSize", String(PAGE)); } catch (e) {}
      palmPage = 1;
      render();
    };
  }
  if ($("#ps_sec")) {
    $("#ps_sec").onchange = () => {
      printScopeSec = $("#ps_sec").value;
      printScopePlot = "all";
      render();
    };
  }
  if ($("#ps_plot")) {
    $("#ps_plot").onchange = () => {
      printScopePlot = $("#ps_plot").value;
      render();
    };
  }
  if ($("#ps_crop")) {
    $("#ps_crop").onchange = () => {
      printScopeCrop = $("#ps_crop").value;
      render();
    };
  }
  if ($("#aud_search")) {
    $("#aud_search").oninput = () => {
      audSearch = $("#aud_search").value;
      audPage = 1;
      render();
    };
  }
  if ($("#opsall")) {
    const updateOpsBadge = () => {
      const b = $("#ops_selected_badge");
      if (b) {
        b.textContent = opsSelectedIds.size;
        b.style.display = opsSelectedIds.size > 0 ? "inline-block" : "none";
      }
    };
    $("#opsall").onchange = () => {
      const isChecked = $("#opsall").checked;
      $$(".opchk").forEach(c => {
        c.checked = isChecked;
        if (isChecked) opsSelectedIds.add(c.value);
        else opsSelectedIds.delete(c.value);
      });
      updateOpsBadge();
    };
    $$(".opchk").forEach(chk => {
      chk.onchange = () => {
        if (chk.checked) opsSelectedIds.add(chk.value);
        else opsSelectedIds.delete(chk.value);
        if ($("#opsall")) {
          const allBoxes = $$(".opchk");
          $("#opsall").checked = allBoxes.length > 0 && allBoxes.every(c => c.checked);
        }
        updateOpsBadge();
      };
    });
  }
  if ($("#opsq")) {
    $("#opsq").onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        act("apply-ops");
      }
    };
  }
  if ($("#ylevel")) {
    const applyY = () => {
      const st = Store.get();
      const lv = $("#ylevel") ? $("#ylevel").value : "plot";
      const cId = $("#ycrop")?.value || yieldRegCrop || "palm";
      const curCropObj = (st.crops || []).find(c => c.id === cId);
      const unitName = curCropObj?.unit || "كجم";
      const singleLabel = curCropObj ? curCropObj.single : "شجرة / أصل";

      $("#ysecw")?.classList.toggle("hidden", false);
      $("#yplotw")?.classList.toggle("hidden", lv === "sector");
      $("#ypalmw")?.classList.toggle("hidden", lv !== "palm");

      // Update varieties dropdown if needed
      if ($("#yvar")) {
        const curVar = $("#yvar").value;
        const cropVars = (st.cropVarieties || []).filter(v => v.cropId === cId).map(v => v.name);
        const allVars = cropVars.length ? cropVars : (st.varieties || []);
        const varOpts = [`<option value="">الكل (أو غير محدد)</option>`].concat(
          allVars.map(v => `<option value="${v}" ${v === curVar ? "selected" : ""}>${v}</option>`)
        );
        $("#yvar").innerHTML = varOpts.join("");
      }

      let selectedPlotId = $("#yplot")?.value || "";

      if (lv !== "sector" && $("#yplot")) {
        const sec = $("#ysec") ? $("#ysec").value : "";
        let plotsOfSec = st.plots.filter(p => !sec || p.sector === sec);

        const q = ($("#yplot_search")?.value || "").trim().toLowerCase();
        if (q) {
          plotsOfSec = plotsOfSec.filter(p => p.id.toLowerCase().includes(q) || (p.name || "").toLowerCase().includes(q) || plotBaseNumber(p).toLowerCase().includes(q));
        }

        // Group by base plot ID
        const baseMap = new Map();
        plotsOfSec.forEach(p => {
          const bId = plotBaseId(p);
          if (!baseMap.has(bId)) baseMap.set(bId, []);
          baseMap.get(bId).push(p);
        });

        // Quick Chips for Base Plots
        if ($("#yplot_chips")) {
          const chipsHtml = [];
          baseMap.forEach((subs, bId) => {
            const bNo = plotBaseNumber(subs[0]) || bId;
            const allSubsSelected = subs.length > 0 && subs.every(s => yieldSelectedPlots.has(s.id));
            const someSubsSelected = subs.some(s => yieldSelectedPlots.has(s.id));
            const isSel = allSubsSelected || selectedPlotId === `base:${bId}`;
            const btnCls = isSel ? 'btn-primary' : (someSubsSelected ? 'btn-outline' : 'btn-ghost');
            chipsHtml.push(`<button type="button" class="btn ${btnCls}" data-act="pick-yield-base" data-id="${bId}" style="width:auto;padding:3px 8px;font-size:11px;white-space:nowrap;border-radius:6px" title="تحديد/إلغاء القطعة ${bNo} بكافة أجزائها">${isSel ? '✓ ' : ''}⭐ ق ${bNo}</button>`);
          });
          $("#yplot_chips").innerHTML = chipsHtml.join("") || "<span class='muted' style='font-size:11px'>لا توجد قطع</span>";
        }

        // Sub-parts chips strip
        if ($("#yplot_parts_chips")) {
          const partsHtml = [];
          plotsOfSec.forEach(p => {
            const isPartSel = yieldSelectedPlots.has(p.id);
            const partPalms = st.palms.filter(x => x.plot === p.id && (p.cropId || "palm") === cId && !x.archived).length;
            partsHtml.push(`<button type="button" class="btn ${isPartSel ? 'btn-primary' : 'btn-ghost'}" data-act="pick-yield-part" data-id="${p.id}" style="width:auto;padding:2px 7px;font-size:11px;white-space:nowrap;border-radius:6px" title="تحديد/إلغاء جزء القطعة">${isPartSel ? '✓ ' : ''}${p.name || p.id} (${partPalms})</button>`);
          });
          $("#yplot_parts_chips").innerHTML = plotsOfSec.length > 1 
            ? `<div style="font-size:11px;color:var(--muted);width:100%;margin-bottom:2px">الأجزاء الفرعية:</div>` + partsHtml.join("")
            : "";
        }

        // Selected Scope Box
        if ($("#yplot_scope_box")) {
          if (yieldSelectedPlots.size > 0) {
            const scopeChips = [...yieldSelectedPlots].map(pid => {
              const plPalms = st.palms.filter(x => x.plot === pid && (x.cropId || "palm") === cId && !x.archived).length;
              return `<span class="chip" style="font-size:11px;background:#e0f2fe;color:#0369a1;padding:3px 8px">${plotName(pid)} (${plPalms} ${singleLabel}) <button type="button" class="chip-x" data-act="yield-drop-plot" data-id="${pid}" style="color:#0369a1">×</button></span>`;
            });
            const totPalms = st.palms.filter(x => yieldSelectedPlots.has(x.plot) && (x.cropId || "palm") === cId && !x.archived).length;
            $("#yplot_scope_box").innerHTML = `
              <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:8px;margin:4px 0">
                <div style="font-size:11.5px;font-weight:700;color:#0369a1;margin-bottom:4px;display:flex;justify-content:space-between">
                  <span>🎯 القطع والأجزاء المحددة (${yieldSelectedPlots.size} قطعة/جزء):</span>
                  <span>إجمالي الأشجار: <b>${totPalms}</b> ${singleLabel}</span>
                </div>
                <div style="display:flex;gap:4px;flex-wrap:wrap">${scopeChips.join("")}</div>
              </div>
            `;
          } else {
            $("#yplot_scope_box").innerHTML = "";
          }
        }

        // Build plot options
        const plotOptions = [];
        baseMap.forEach((subs, bId) => {
          const bNo = plotBaseNumber(subs[0]) || bId;
          const basePalms = st.palms.filter(p => (plotBaseId(p.plot) === bId || p.plot.startsWith(bId)) && (p.cropId || "palm") === cId && !p.archived);
          if (subs.length > 1) {
            const subLabels = subs.map(s => s.part || s.id).filter(Boolean).join(", ");
            const isBaseSel = selectedPlotId === `base:${bId}`;
            plotOptions.push(`<option value="base:${bId}" ${isBaseSel ? "selected" : ""} style="font-weight:bold;color:var(--green-d)">⭐ القطعة ${bNo} (كافة الأجزاء: ${subLabels}) — [${basePalms.length} ${singleLabel}]</option>`);
            subs.forEach(s => {
              const subPalms = st.palms.filter(p => p.plot === s.id && (p.cropId || "palm") === cId && !p.archived);
              const isSubSel = selectedPlotId === s.id;
              plotOptions.push(`<option value="${s.id}" ${isSubSel ? "selected" : ""}>&nbsp;&nbsp;&nbsp;↳ قطعة ${s.part || s.id} (${s.id}) — [${subPalms.length} ${singleLabel}]</option>`);
            });
          } else {
            const s = subs[0];
            const isSubSel = selectedPlotId === s.id;
            plotOptions.push(`<option value="${s.id}" ${isSubSel ? "selected" : ""}>${s.name} (${s.id}) — [${basePalms.length} ${singleLabel}]</option>`);
          }
        });

        if (!plotOptions.length) {
          $("#yplot").innerHTML = `<option value="">لا توجد قطع مطابقة للبحث بالقطاع</option>`;
        } else {
          $("#yplot").innerHTML = plotOptions.join("");
          if (selectedPlotId && $("#yplot").querySelector(`option[value="${selectedPlotId}"]`)) {
            $("#yplot").value = selectedPlotId;
          } else {
            selectedPlotId = $("#yplot").value;
          }
        }
        if ($("#yplot_count_badge")) {
          $("#yplot_count_badge").textContent = `${plotsOfSec.length} قطعة/جزء بالقطاع`;
        }
      }

      // Populate palms if lv === "palm"
      if (lv === "palm" && $("#ypalm")) {
        const plotVal = $("#yplot")?.value || "";
        let palms = [];
        if (yieldSelectedPlots.size > 0) {
          palms = st.palms.filter(p => yieldSelectedPlots.has(p.plot) && (p.cropId || "palm") === cId && !p.archived);
        } else if (plotVal.startsWith("base:")) {
          const bId = plotVal.slice(5);
          palms = st.palms.filter(p => (plotBaseId(p.plot) === bId || p.plot.startsWith(bId)) && (p.cropId || "palm") === cId && !p.archived);
        } else {
          palms = st.palms.filter(p => p.plot === plotVal && (p.cropId || "palm") === cId && !p.archived);
        }
        if (!palms.length) {
          $("#ypalm").innerHTML = `<option value="">لا توجد أشجار مسجلة في هذا النطاق</option>`;
        } else {
          $("#ypalm").innerHTML = palms.map(p => `<option value="${p.id}">${cropIcon(p.cropId, 14)} ${p.code} (${p.variety || '—'})</option>`).join("");
        }
      }

      updateYieldPreview(st, lv, cId, unitName, singleLabel);
    };

    const updateYieldPreview = (st, lv, cId, unitName, singleLabel) => {
      st = st || Store.get();
      lv = lv || ($("#ylevel")?.value || "plot");
      cId = cId || ($("#ycrop")?.value || yieldRegCrop || "palm");
      const curCropObj = (st.crops || []).find(c => c.id === cId);
      unitName = unitName || curCropObj?.unit || "كجم";
      singleLabel = singleLabel || (curCropObj ? curCropObj.single : "شجرة / أصل");

      const plotVal = $("#yplot")?.value || "";
      const secVal = $("#ysec")?.value || "";
      let targetTreeCount = 0;
      let targetLabel = "";

      if (lv === "sector") {
        const secPalms = st.palms.filter(p => {
          const pl = st.plots.find(x => x.id === p.plot);
          return pl?.sector === secVal && (p.cropId || "palm") === cId && !p.archived;
        });
        targetTreeCount = secPalms.length;
        targetLabel = `${sectorName(secVal)} (إجمالي)`;
      } else if (yieldSelectedPlots.size > 0) {
        const selPalms = st.palms.filter(p => yieldSelectedPlots.has(p.plot) && (p.cropId || "palm") === cId && !p.archived);
        targetTreeCount = selPalms.length;
        targetLabel = `${yieldSelectedPlots.size} قطع/أجزاء (${[...yieldSelectedPlots].map(p => plotName(p)).join("، ")})`;
      } else if (plotVal.startsWith("base:")) {
        const bId = plotVal.slice(5);
        const bPalms = st.palms.filter(p => (plotBaseId(p.plot) === bId || p.plot.startsWith(bId)) && (p.cropId || "palm") === cId && !p.archived);
        targetTreeCount = bPalms.length;
        targetLabel = plotName(plotVal);
      } else if (plotVal) {
        const pPalms = st.palms.filter(p => p.plot === plotVal && (p.cropId || "palm") === cId && !p.archived);
        targetTreeCount = pPalms.length;
        targetLabel = plotName(plotVal);
      } else {
        targetLabel = "لم يتم تحديد قطعة";
      }

      // Check user specified harvested palms count
      const customHarvested = parseInt($("#yharvested_count")?.value, 10);
      const effectiveCount = (!isNaN(customHarvested) && customHarvested > 0) ? customHarvested : targetTreeCount;

      if ($("#yinfo_title") && $("#yinfo_desc")) {
        if (lv === "sector") {
          $("#yinfo_title").textContent = `🌐 إسناد إجمالي لقطاع: ${targetLabel}`;
          $("#yinfo_desc").textContent = `يسجل الإنتاج ككتلة واحدة على مستوى القطاع، يحتوي القطاع على ${targetTreeCount} ${singleLabel}.`;
        } else if (lv === "split") {
          $("#yinfo_title").textContent = `⚖️ توزيع متساوٍ: ${targetLabel}`;
          $("#yinfo_desc").innerHTML = effectiveCount > 0 
            ? `سيتم احتساب إجمالي الوزن وتوزيعه بالتساوي على <b>${effectiveCount}</b> ${singleLabel} (${customHarvested ? 'محددة يدوياً كمجمُوعة' : 'المسجلة في هذا النطاق'}).` 
            : `<span style="color:var(--err)">⚠️ تنبيه: لا توجد أي أصول/أشجار مسجلة لهذا المحصول في هذا الموقع!</span>`;
        } else if (lv === "palm") {
          $("#yinfo_title").textContent = `🌴 إسناد لشجرة / أصل محدد`;
          $("#yinfo_desc").textContent = `يُسجل المحصول والوزن مباشرة في السجل الفردي للشجرة المختارة.`;
        } else {
          $("#yinfo_title").textContent = `📍 إسناد على مستوى القطعة: ${targetLabel}`;
          $("#yinfo_desc").textContent = `تسجيل إجمالي موحد للإنتاجية دون توزيع فردي على الأشجار. يحتوي النطاق على ${targetTreeCount} ${singleLabel}.`;
        }
      }

      // Compute live weight totals
      const exVal = parseFloat(toCleanDigits($("#yex")?.value || 0)) || 0;
      const gdVal = parseFloat(toCleanDigits($("#ygd")?.value || 0)) || 0;
      const badVal = parseFloat(toCleanDigits($("#ybad")?.value || 0)) || 0;
      const totalKg = +(exVal + gdVal + badVal).toFixed(2);

      if ($("#ycalc_total")) {
        $("#ycalc_total").innerHTML = `${totalKg.toLocaleString()} <span style="font-size:14px;color:var(--muted)">${unitName}</span>`;
      }

      const pctEx = totalKg ? Math.round(exVal / totalKg * 100) : 0;
      const pctGd = totalKg ? Math.round(gdVal / totalKg * 100) : 0;
      const pctBad = totalKg ? Math.round(badVal / totalKg * 100) : 0;

      if ($("#ycalc_ex_pct")) $("#ycalc_ex_pct").textContent = `🌟 ممتاز: ${exVal} (${pctEx}%)`;
      if ($("#ycalc_gd_pct")) $("#ycalc_gd_pct").textContent = `👍 جيد: ${gdVal} (${pctGd}%)`;
      if ($("#ycalc_bad_pct")) $("#ycalc_bad_pct").textContent = `🍂 تالف: ${badVal} (${pctBad}%)`;

      if ($("#ycalc_split_info")) {
        if (lv === "split") {
          const perTree = effectiveCount > 0 ? (totalKg / effectiveCount).toFixed(2) : "0.00";
          $("#ycalc_split_info").innerHTML = `💡 نصيب الشجرة الواحدة: <b style="color:var(--green-d);font-size:13px">${perTree} ${unitName}</b> (لكل أصل من أصل ${effectiveCount} ${singleLabel} مجمُوعة)`;
        } else {
          $("#ycalc_split_info").innerHTML = "";
        }
      }
    };

    window._applyY = applyY;
    window._updateYieldPreview = updateYieldPreview;

    $("#ylevel").onchange = applyY;
    $("#ycrop") && ($("#ycrop").onchange = () => { yieldRegCrop = $("#ycrop").value; applyY(); });
    $("#ysec") && ($("#ysec").onchange = () => { yieldSelectedPlots.clear(); applyY(); });
    $("#yplot") && ($("#yplot").onchange = applyY);
    $("#ypalm") && ($("#ypalm").onchange = () => updateYieldPreview());
    $("#yharvested_count") && ($("#yharvested_count").oninput = () => updateYieldPreview());

    if ($("#yplot_search")) {
      $("#yplot_search").oninput = () => applyY();
    }

    ["yex", "ygd", "ybad"].forEach(fId => {
      const el = $(`#${fId}`);
      if (el) {
        el.oninput = () => updateYieldPreview();
        el.onchange = () => updateYieldPreview();
      }
    });

    applyY();
  }

  if ($("#ytable_search")) {
    $("#ytable_search").oninput = (e) => {
      yieldTableSearch = e.target.value;
      render();
      const inp = $("#ytable_search");
      if (inp) {
        inp.focus();
        inp.setSelectionRange(inp.value.length, inp.value.length);
      }
    };
  }
  if ($("#ytable_sec")) {
    $("#ytable_sec").onchange = () => {
      yieldTableSec = $("#ytable_sec").value;
      render();
    };
  }
  if ($("#ytable_qual")) {
    $("#ytable_qual").onchange = () => {
      yieldTableQuality = $("#ytable_qual").value;
      render();
    };
  }
  if ($("#clogo")) {
    $("#clogo").onchange = () => {
      const file = $("#clogo")?.files?.[0];
      if (file) {
        const rd = new FileReader();
        rd.onload = () => {
          const st = Store.get();
          st.settings.logo = rd.result;
          Store.set({ settings: st.settings });
          toast("تم تحميل وتحديث شعار المنشأة بنجاح 📷");
          render();
        };
        rd.readAsDataURL(file);
      }
    };
  }
  if ($("#var_search")) {
    $("#var_search").oninput = (e) => {
      varSearchQuery = e.target.value;
      render();
      const inp = $("#var_search");
      if (inp) {
        inp.focus();
        inp.setSelectionRange(inp.value.length, inp.value.length);
      }
    };
  }
  if ($("#optype_search")) {
    $("#optype_search").oninput = (e) => {
      opsTypeSearch = e.target.value;
      render();
      const inp = $("#optype_search");
      if (inp) {
        inp.focus();
        inp.setSelectionRange(inp.value.length, inp.value.length);
      }
    };
  }
}
function cascadeScan(level) {
  const st = Store.get();
  const allowed = session().role === "worker" ? st.plots.filter(p => (session().plots||[]).includes(p.id)) : st.plots;
  if (level === "sec") {
    const sec = $("#ssec")?.value;
    const plots = allowed.filter(p => p.sector === sec);
    if ($("#plotWrap")) $("#plotWrap").classList.toggle("hidden", !sec);
    if ($("#palmWrap")) $("#palmWrap").classList.add("hidden");
    if ($("#splot")) $("#splot").innerHTML = `<option value="">— اختر القطعة —</option>` + plots.map(p=>`<option value="${p.id}">${p.name}</option>`).join("");
  }
  if (level === "plot") {
    const plot = $("#splot")?.value;
    let palms = st.palms.filter(p => p.plot === plot && workerAllowed(p.plot, p.id) && !p.archived);
    if (scanCrop) palms = palms.filter(p => (p.cropId || "palm") === scanCrop);
    if ($("#palmWrap")) $("#palmWrap").classList.toggle("hidden", !plot);
    const capped = palms.slice(0, 100);
    if ($("#spalm")) $("#spalm").innerHTML = `<option value="">— اختر الشجرة (${palms.length}) —</option>` + capped.map(p=>`<option value="${p.id}">${p.code} (${p.variety})</option>`).join("") + (palms.length > 100 ? `<option value="" disabled>... و ${palms.length - 100} شجرة أخرى (استخدم البحث السريع)</option>` : "");
  }
}

// Early Warning Event Handlers
function handleEarlyWarningActions(name, id, extra, stRaw) {
  const st = stRaw || Store.get();

  if (name === "early-warning-crop") {
    earlyWarningCrop = id || "all";
    render();
    return true;
  }
  if (name === "early-warning-filter") {
    earlyWarningRiskFilter = id || $("#ew_risk_filter")?.value || "all";
    render();
    return true;
  }
  if (name === "ew-open-new-rule") {
    editingEarlyWarningRuleId = null;
    showEarlyWarningRuleModal = true;
    render();
    return true;
  }
  if (name === "ew-edit-rule") {
    editingEarlyWarningRuleId = id;
    showEarlyWarningSopModal = false;
    sopTargetRuleId = null;
    showEarlyWarningRuleModal = true;
    render();
    return true;
  }
  if (name === "ew-delete-rule") {
    if (!confirm("هل أنت متأكد من حذف قاعدة الإنذار المبكر هذه؟")) return true;
    st.earlyWarningRules = (st.earlyWarningRules || []).filter(r => r.id !== id);
    Store.set({ earlyWarningRules: st.earlyWarningRules });
    toast("تم حذف قاعدة الإنذار المبكر");
    render();
    return true;
  }
  if (name === "ew-save-rule") {
    const nameVal = $("#ew_r_name")?.value?.trim();
    if (!nameVal) { toast("يرجى إدخال اسم الآفة"); return true; }
    const scientificName = $("#ew_r_sci")?.value?.trim() || "";
    const cropId = $("#ew_r_crop")?.value || "all";
    const type = $("#ew_r_type")?.value || "حشري";
    const riskLevel = $("#ew_r_risk")?.value || "high";
    const activityStartMonth = parseInt($("#ew_r_smonth")?.value, 10) || 1;
    const activityEndMonth = parseInt($("#ew_r_emonth")?.value, 10) || 12;
    const leadDays = parseInt($("#ew_r_lead")?.value, 10) || 14;
    const criticalStage = $("#ew_r_stage")?.value?.trim() || "";
    const weatherTriggers = $("#ew_r_weather")?.value?.trim() || "";
    const mechanical = $("#ew_r_mech")?.value?.trim() || "";
    const materialName = $("#ew_r_mat")?.value?.trim() || "";
    const defaultDose = $("#ew_r_dose")?.value?.trim() || "";
    const phi = parseInt($("#ew_r_phi")?.value, 10) || 14;
    const curativeText = $("#ew_r_curative")?.value?.trim() || "";
    const curativeSteps = curativeText ? curativeText.split("\n").map(s => s.trim()).filter(Boolean) : [];
    const guideSOP = $("#ew_r_sop")?.value?.trim() || "";

    if (!st.earlyWarningRules) st.earlyWarningRules = [];

    if (editingEarlyWarningRuleId) {
      const idx = st.earlyWarningRules.findIndex(r => r.id === editingEarlyWarningRuleId);
      if (idx >= 0) {
        st.earlyWarningRules[idx] = {
          ...st.earlyWarningRules[idx],
          name: nameVal, scientificName, cropId, type, riskLevel,
          activityStartMonth, activityEndMonth, leadDays,
          criticalStage, weatherTriggers,
          preventiveActions: { mechanical, spray: `الرش بـ ${materialName}`, materialName, defaultDose, phi },
          curativeProtocol: { title: `بروتوكول المعاملة الفورية لـ ${nameVal}`, steps: curativeSteps },
          guideSOP: guideSOP || st.earlyWarningRules[idx].guideSOP || `دليل ومعايير الإشراف الفني لـ ${nameVal}.`
        };
      }
      toast(`تم تحديث قاعدة [${nameVal}] بنجاح ✅`);
    } else {
      const newRule = {
        id: Store.uid("ew"),
        name: nameVal, scientificName, cropId, type, riskLevel,
        activityStartMonth, activityEndMonth, leadDays,
        criticalStage, weatherTriggers,
        preventiveActions: { mechanical, spray: `الرش بـ ${materialName}`, materialName, defaultDose, phi },
        curativeProtocol: { title: `بروتوكول المعاملة الفورية لـ ${nameVal}`, steps: curativeSteps },
        guideSOP: guideSOP || `دليل ومعايير الإشراف الفني لـ ${nameVal}.`,
        active: true
      };
      st.earlyWarningRules.push(newRule);
      toast(`تمت إضافة قاعدة الإنذار [${nameVal}] بنجاح 🛡️`);
    }
    Store.set({ earlyWarningRules: st.earlyWarningRules });
    showEarlyWarningRuleModal = false;
    editingEarlyWarningRuleId = null;
    showEarlyWarningSopModal = false;
    sopTargetRuleId = null;
    render();
    return true;
  }
  if (name === "ew-open-order") {
    orderTargetRuleId = id;
    showOrderFromEarlyWarningModal = true;
    render();
    return true;
  }
  if (name === "ew-create-work-order") {
    const rule = (st.earlyWarningRules || []).find(r => r.id === id);
    const title = $("#ew_wo_title")?.value?.trim() || (rule ? `مكافحة وقائية ضد ${rule.name}` : "أمر عمل وقائي");
    const kind = $("#ew_wo_kind")?.value || "schedule";
    const priority = $("#ew_wo_priority")?.value || "urgent";
    const sectorId = $("#ew_wo_sec")?.value || "all";
    const plotId = $("#ew_wo_plot")?.value || "all";
    const materialName = $("#ew_wo_mat")?.value?.trim() || (rule?.preventiveActions?.materialName || "");
    const recommendedDose = $("#ew_wo_dose")?.value?.trim() || (rule?.preventiveActions?.defaultDose || "");
    const assignedUserId = $("#ew_wo_user")?.value || "all";
    const assignedRole = assignedUserId !== "all" ? (st.users.find(u => u.id === assignedUserId)?.role || "worker") : "worker";
    const targetDate = $("#ew_wo_date")?.value || new Date().toISOString().slice(0, 10);
    const instructions = $("#ew_wo_instructions")?.value?.trim() || "";

    if (kind === "schedule") {
      if (!st.operationSchedules) st.operationSchedules = [];
      const newSch = {
        id: Store.uid("sch"),
        title,
        cropId: rule?.cropId || "all",
        opTypeId: "op_pest",
        opName: "مكافحة وقائية وعلاجية",
        sectorId,
        plotId,
        plotIds: plotId !== "all" ? [plotId] : [],
        intervalDays: 14,
        nextDueDate: targetDate,
        lastExecutedAt: null,
        assignedRole,
        assignedUserId,
        priority,
        materialName,
        recommendedDose,
        instructions,
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: session()?.id || "u1"
      };
      st.operationSchedules.unshift(newSch);
      Store.set({ operationSchedules: st.operationSchedules });
    } else {
      if (!st.operations) st.operations = [];
      const newOp = {
        id: Store.uid("op"),
        typeId: "op_pest",
        cropId: rule?.cropId || "all",
        sectorId,
        plotId,
        at: targetDate,
        workerId: assignedUserId !== "all" ? assignedUserId : (session()?.id || "u3"),
        notes: `${title} • ${instructions}`,
        material: materialName,
        amount: recommendedDose,
        status: "pending",
        approval: "pending"
      };
      st.operations.unshift(newOp);
      Store.set({ operations: st.operations });
    }

    if (!st.notifications) st.notifications = [];
    st.notifications.unshift({
      id: Store.uid("notif"),
      userId: assignedUserId,
      type: "ops",
      title: "⚡ أمر عمل ميداني استباقي جديد",
      text: `تم تكليفك بأمر عمل وقائي: [${title}] بالقطاع [${sectorId}] لمكافحة [${rule?.name || ''}] بتاريخ ${targetDate}.`,
      createdAt: new Date().toISOString(),
      read: false
    });
    Store.set({ notifications: st.notifications });

    showOrderFromEarlyWarningModal = false;
    orderTargetRuleId = null;
    toast(`تم إصدار أمر العمل الميداني وإسناده بنجاح ✅`);
    render();
    return true;
  }
  if (name === "ew-open-stock") {
    stockCheckTargetRuleId = id;
    showStockCheckModal = true;
    render();
    return true;
  }
  if (name === "ew-stock-issue-request") {
    const fertId = id;
    const fert = (st.fertilizers || []).find(f => f.id === fertId);
    const reqQty = 20;
    if (!st.fertilizerVouchers) st.fertilizerVouchers = [];
    const voucher = {
      id: "V-" + new Date().getFullYear() + "-" + String(st.fertilizerVouchers.length + 1).padStart(3, "0"),
      date: new Date().toISOString().slice(0, 10),
      type: "issue",
      fertId: fert?.id || "ft6",
      fertName: fert?.name || "مبيد وقائي",
      qty: reqQty,
      unit: fert?.unit || "لتر",
      from: "المخزن الرئيسي",
      toUser: session()?.id || "u2",
      sectorId: "03",
      status: "pending",
      notes: "طلب صرف مواد لمكافحة وقائية استباقية",
      createdAt: new Date().toISOString()
    };
    st.fertilizerVouchers.unshift(voucher);
    Store.set({ fertilizerVouchers: st.fertilizerVouchers });
    showStockCheckModal = false;
    stockCheckTargetRuleId = null;
    toast("تم إنشاء إذن صرف المواد وتوجيهه لأمين المستودع 📦");
    render();
    return true;
  }
  if (name === "ew-open-notify") {
    notifyTargetRuleId = id;
    showNotifyInvestorsEarlyWarningModal = true;
    render();
    return true;
  }
  if (name === "ew-send-investor-notif") {
    const rule = (st.earlyWarningRules || []).find(r => r.id === id);
    const msg = $("#ew_inv_msg")?.value?.trim() || "إشعار وقائي من إدارة المزرعة.";
    const ev = evaluateEarlyWarningRule(rule, st);
    const targetPlots = new Set(ev.affectedPlots);
    const targetInvestors = st.users.filter(u => {
      if (u.role !== "investor") return false;
      const invPlots = u.plots || [];
      return invPlots.some(p => targetPlots.has(p) || targetPlots.size === 0);
    });

    if (!st.notifications) st.notifications = [];
    targetInvestors.forEach(inv => {
      st.notifications.unshift({
        id: Store.uid("notif"),
        userId: inv.id,
        type: "early_warning",
        title: `🛡️ درع الحماية الاستباقية: ${rule?.name || 'وقاية المحصول'}`,
        text: msg,
        createdAt: new Date().toISOString(),
        read: false
      });
    });
    Store.set({ notifications: st.notifications });
    showNotifyInvestorsEarlyWarningModal = false;
    notifyTargetRuleId = null;
    toast(`تم إرسال إشعار الحماية الاستباقية إلى (${targetInvestors.length}) مستثمر بنجاح 📢`);
    render();
    return true;
  }
  if (name === "ew-open-sop") {
    sopTargetRuleId = id;
    showEarlyWarningSopModal = true;
    render();
    return true;
  }
  if (name === "ew-close-modal") {
    showEarlyWarningRuleModal = false;
    editingEarlyWarningRuleId = null;
    showEarlyWarningSopModal = false;
    sopTargetRuleId = null;
    showStockCheckModal = false;
    stockCheckTargetRuleId = null;
    showOrderFromEarlyWarningModal = false;
    orderTargetRuleId = null;
    showNotifyInvestorsEarlyWarningModal = false;
    notifyTargetRuleId = null;
    render();
    return true;
  }
  return false;
}


function printHarvestBatchSticker(y, st) {
  if (!y) return;
  st = st || Store.get();
  const cLabel = cropSingle(y.cropId || "palm");
  const cIco = cropIcon(y.cropId || "palm", 22);
  const uObj = userBy(y.by || y.recordedBy || y.recorded_by);
  const uName = uObj ? uObj.name : (y.recordedByName || y.recorded_by_name || "مشرف الحصاد الميداني");
  const unit = (y.cropId === "olive") ? "كجم" : "كجم";

  // Dynamic Enterprise / Farm Branding
  const co = (typeof getActiveCompany === "function") ? getActiveCompany() : null;
  const proj = (typeof getActiveProject === "function") ? getActiveProject() : null;
  const farmDisplayName = co?.tradeName || co?.trade_name || co?.name || st?.settings?.companyName || "مزارع النخيل";
  const farmLocation = proj?.locationName || proj?.location_name || "واحة الفرافرة • الوادي الجديد";
  const farmLogo = co?.logo || st?.settings?.logo || "";

  // Formulate field location
  let locLabel = "—";
  if (Array.isArray(y.plotIds) && y.plotIds.length > 1) {
    locLabel = `${sectorName(y.sectorId)} • ${y.plotIds.length} قطع (${y.plotIds.map(p => plotName(p)).join("، ")})`;
  } else if (y.plotId) {
    locLabel = `${sectorName(y.sectorId)} • ${plotName(y.plotId)}`;
  } else if (y.sectorId) {
    locLabel = sectorName(y.sectorId);
  } else if (y.level === "palm" && y.palmId) {
    const p = palmById(y.palmId);
    locLabel = p ? `${plotName(p.plot)} • أصل: ${p.code}` : y.palmId;
  }

  const ex = Number(y.kgEx) || (y.quality === "ممتاز" ? Number(y.kg) : 0);
  const gd = Number(y.kgGd) || (y.quality === "جيد" ? Number(y.kg) : 0);
  const bad = Number(y.kgBad) || 0;
  const total = Number(y.kg) || (ex + gd + bad);
  const pctEx = total ? Math.round(ex / total * 100) : 0;
  const pctGd = total ? Math.round(gd / total * 100) : 0;
  const pctBad = total ? Math.round(bad / total * 100) : 0;

  const w = window.open("", "_blank");
  if (!w) return toast("يرجى السماح بالنوافذ المنبثقة لطباعة الملصق");

  const batchCode = y.batch || y.id;
  const gradeLabel = pctEx >= 70 ? "فرز ممتاز ★★★ (Grade A)" : (pctGd >= 50 ? "فرز جيد ★★" : "فرز نخب أول");

  w.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>ملصق التتبع الذكي والشحنة - ${batchCode}</title>
  <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"><\/script>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      margin: 0;
      padding: 14px;
      background: #f1f5f9;
      color: #111827;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .no-print-bar {
      margin-bottom: 16px;
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
      background: #fff;
      padding: 10px 16px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      border: 1px solid #e2e8f0;
      max-width: 900px;
      width: 100%;
      justify-content: space-between;
    }
    .btn-toggle-group {
      display: inline-flex;
      background: #f1f5f9;
      padding: 3px;
      border-radius: 8px;
      gap: 3px;
    }
    .btn {
      padding: 8px 14px;
      border-radius: 7px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
      font-family: inherit;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-mode {
      background: transparent;
      color: #475569;
    }
    .btn-mode.active {
      background: #15803d;
      color: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.15);
    }
    .btn-print { background: #15803d; color: #fff; }
    .btn-passport { background: #0284c7; color: #fff; }
    .btn-close { background: #e2e8f0; color: #334155; }
    
    .weight-ctrl {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 12.5px;
      font-weight: 700;
      color: #334155;
    }
    .weight-ctrl select {
      padding: 5px 8px;
      border-radius: 6px;
      border: 1.5px solid #cbd5e1;
      font-family: inherit;
      font-weight: 700;
      color: #0f172a;
    }

    /* ========================================================
       RETAIL LABEL (50x80mm standard landscape or portrait)
       ======================================================== */
    .retail-card {
      width: 80mm;
      height: 50mm;
      max-width: 100%;
      background: #fff;
      border: 2px solid #14532d;
      border-radius: 6px;
      padding: 4px 6px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-shadow: 0 6px 18px rgba(0,0,0,0.12);
      box-sizing: border-box;
      position: relative;
    }
    .retail-card .top-sec {
      border-bottom: 1.5px solid #14532d;
      padding-bottom: 3px;
      text-align: center;
    }
    .retail-card .farm-line {
      font-size: 11px;
      font-weight: 900;
      color: #14532d;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .retail-card .variety-line {
      font-size: 12px;
      font-weight: 900;
      color: #0f172a;
      margin-top: 1px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .retail-card .grade-badge {
      font-size: 9.5px;
      font-weight: 800;
      color: #92400e;
      background: #fef3c7;
      padding: 1px 5px;
      border-radius: 4px;
      border: 1px solid #fde68a;
    }
    .retail-card .mid-sec {
      display: flex;
      flex: 1;
      padding: 3px 0;
      gap: 6px;
      align-items: center;
    }
    .retail-card .info-col {
      flex: 1.15;
      display: flex;
      flex-direction: column;
      gap: 1.5px;
      font-size: 8.5px;
      color: #334155;
    }
    .retail-card .info-row {
      display: flex;
      justify-content: space-between;
      line-height: 1.25;
    }
    .retail-card .info-row .lbl {
      color: #64748b;
      font-weight: 600;
    }
    .retail-card .info-row .val {
      font-weight: 800;
      color: #0f172a;
    }
    .retail-card .qr-col {
      flex: 0.95;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding-left: 2px;
      border-right: 1px dashed #cbd5e1;
    }
    .retail-card .qr-canvas-wrap {
      width: 78px;
      height: 78px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fff;
    }
    .retail-card .qr-cta {
      font-size: 7px;
      font-weight: 800;
      color: #15803d;
      line-height: 1.1;
      margin-top: 2px;
    }
    .retail-card .btm-sec {
      border-top: 1.5px solid #14532d;
      padding-top: 2px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8px;
      color: #14532d;
      font-weight: 800;
    }
    .retail-card .track-code {
      font-family: monospace;
      font-size: 9.5px;
      letter-spacing: 0.5px;
    }

    /* ========================================================
       BULK SHIPMENT LABEL (A6 / 100x140mm)
       ======================================================== */
    .bulk-card {
      width: 100mm;
      max-width: 100%;
      background: #fff;
      border: 2px solid #111827;
      border-radius: 8px;
      padding: 8px 10px;
      box-shadow: 0 4px 14px rgba(0,0,0,0.12);
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      box-sizing: border-box;
    }
    .bulk-card .header {
      border-bottom: 2px solid #111827;
      padding-bottom: 4px;
      text-align: center;
    }
    .bulk-card .farm-name {
      font-size: 14px;
      font-weight: 900;
      color: #15803d;
      margin: 0;
    }
    .bulk-card .sub-name {
      font-size: 10px;
      color: #4b5563;
      margin-top: 1px;
      font-weight: 600;
    }
    .bulk-card .batch-hero {
      background: #111827;
      color: #fff;
      padding: 4px 8px;
      border-radius: 5px;
      margin: 5px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .bulk-card .batch-hero .b-num {
      font-family: monospace;
      font-size: 15px;
      font-weight: 900;
      letter-spacing: 1px;
    }
    .bulk-card .batch-hero .b-season {
      font-size: 11px;
      background: #374151;
      padding: 1px 6px;
      border-radius: 4px;
      font-weight: bold;
    }
    .bulk-card .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      font-size: 10.5px;
      background: #f9fafb;
      padding: 6px;
      border-radius: 5px;
      border: 1px solid #e5e7eb;
      margin-bottom: 5px;
    }
    .bulk-card .meta-item { display: flex; flex-direction: column; }
    .bulk-card .meta-item .lbl { color: #6b7280; font-size: 9px; }
    .bulk-card .meta-item .val { font-weight: 700; color: #111827; font-size: 11px; }
    .bulk-card .grades-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10.5px;
      margin-bottom: 5px;
    }
    .bulk-card .grades-table th {
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      padding: 3px;
      text-align: center;
      font-size: 9.5px;
    }
    .bulk-card .grades-table td {
      border: 1px solid #d1d5db;
      padding: 4px 3px;
      text-align: center;
      font-weight: 700;
    }
    .bulk-card .total-banner {
      background: #f0fdf4;
      border: 1.5px solid #16a34a;
      border-radius: 6px;
      padding: 4px 8px;
      text-align: center;
      margin-bottom: 5px;
    }
    .bulk-card .total-banner .ttl-lbl {
      font-size: 10px;
      font-weight: 700;
      color: #166534;
    }
    .bulk-card .total-banner .ttl-val {
      font-size: 19px;
      font-weight: 900;
      color: #15803d;
      line-height: 1.1;
    }
    .bulk-card .barcode-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 3px 0;
      border-top: 1px dashed #d1d5db;
      border-bottom: 1px dashed #d1d5db;
      margin-bottom: 4px;
    }
    .bulk-card .barcode-svg {
      width: 80%;
      height: 26px;
    }
    .bulk-card .sig-block {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #4b5563;
      padding-top: 3px;
      border-top: 1px solid #e5e7eb;
    }

    /* Print styles */
    @media print {
      html, body {
        background: #fff !important;
        margin: 0 !important;
        padding: 0 !important;
        height: 100%;
        overflow: hidden !important;
      }
      .no-print-bar { display: none !important; }
      body.mode-retail .bulk-card { display: none !important; }
      body.mode-bulk .retail-card { display: none !important; }

      body.mode-retail .retail-card {
        border: 2px solid #000;
        box-shadow: none;
        width: 80mm;
        height: 50mm;
        margin: 0 auto;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      body.mode-bulk .bulk-card {
        border: 2px solid #000;
        box-shadow: none;
        width: 96mm;
        max-width: 96mm;
        margin: 0 auto;
        padding: 6px 8px;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      @page {
        margin: 1.5mm;
      }
    }
  </style>
</head>
<body class="mode-retail">

  <div class="no-print-bar">
    <div class="btn-toggle-group">
      <button class="btn btn-mode active" id="btnRetail" onclick="setMode('retail')">🏷️ ملصق عبوة تجزئة (50×80 مم)</button>
      <button class="btn btn-mode" id="btnBulk" onclick="setMode('bulk')">📦 ملصق شحنة كاملة (A6)</button>
    </div>

    <div class="weight-ctrl" id="weightBox">
      <span>الوزن الصافي للعبوة:</span>
      <select onchange="updateWeight(this.value)">
        <option value="1 كجم" selected>1 كجم (عبوة قياسية)</option>
        <option value="2 كجم">2 كجم (عبوة عائلية)</option>
        <option value="500 جم">500 جم (نصف كجم)</option>
        <option value="3 كجم">3 كجم</option>
        <option value="5 كجم">5 كجم (كرتونة جملة)</option>
      </select>
    </div>

    <div style="display:flex;gap:8px">
      <button class="btn btn-print" onclick="window.print()">🖨️ طباعة الآن</button>
      <button class="btn btn-passport" onclick="openPassport()">🌐 صفحة التتبع</button>
      <button class="btn btn-close" onclick="window.close()">✕ إغلاق</button>
    </div>
  </div>

  <!-- 1. SMART RETAIL PACK LABEL (50x80mm) -->
  <div class="retail-card" id="retailCard">
    <div class="top-sec">
      <div class="farm-line">
        <span style="display:inline-flex;align-items:center;gap:6px">
          ${farmLogo ? `<img src="${farmLogo}" style="height:17px;max-width:28px;object-fit:contain;border-radius:3px" alt="logo">` : '🌿'}
          <b>${escapeHtml(farmDisplayName)}</b>
        </span>
        <span style="font-size:9.5px;color:#334155">${escapeHtml(farmLocation)}</span>
      </div>
      <div class="variety-line">
        <span>تمر ${y.variety || "برحي"} فاخر</span>
        <span class="grade-badge">${gradeLabel}</span>
      </div>
    </div>

    <div class="mid-sec">
      <div class="info-col">
        <div class="info-row"><span class="lbl">الوزن الصافي:</span><span class="val" id="lblNetWeight">1 كجم</span></div>
        <div class="info-row"><span class="lbl">الموسم:</span><span class="val">${y.season || "2026"}م</span></div>
        <div class="info-row"><span class="lbl">القطاع والقطعة:</span><span class="val">${sectorName(y.sectorId)}</span></div>
        <div class="info-row"><span class="lbl">نظام ومصدر الري:</span><span class="val">مياه جوفية نقية</span></div>
        <div class="info-row"><span class="lbl">تاريخ التعبئة:</span><span class="val">${y.date || '2026/09'}</span></div>
        <div class="info-row"><span class="lbl">الصلاحية:</span><span class="val">12 شهراً</span></div>
      </div>
      
      <div class="qr-col">
        <div class="qr-canvas-wrap">
          <canvas id="qrCanvasRetail"></canvas>
        </div>
        <div class="qr-cta">امسح الرمز لتتبع رحلة النخلة وسجل الرعاية</div>
      </div>
    </div>

    <div class="btm-sec">
      <span>كود التتبع: <b class="track-code">${batchCode}</b></span>
      <span>🌱 منتج طبيعي 100% موثق المصدر</span>
    </div>
  </div>

  <!-- 2. BULK SHIPMENT LABEL (A6) -->
  <div class="bulk-card" id="bulkCard" style="display:none;margin-top:10px">
    <div class="header">
      <div class="farm-name" style="display:flex;align-items:center;justify-content:center;gap:8px">
        ${farmLogo ? `<img src="${farmLogo}" style="height:22px;max-width:36px;object-fit:contain" alt="logo">` : '🌿'}
        <span>${escapeHtml(farmDisplayName)}</span>
      </div>
      <div class="sub-name">ملصق شحنة الحصاد والتوريد المعتمد • إدارة الجودة والمحاصيل</div>
    </div>

    <div class="batch-hero">
      <div class="b-num">${batchCode}</div>
      <div class="b-season">موسم ${y.season || "2026"}م</div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <span class="lbl">نوع المحصول</span>
        <span class="val">${cIco} ${cLabel}</span>
      </div>
      <div class="meta-item">
        <span class="lbl">الصنف</span>
        <span class="val">${y.variety || "غير محدد / عام"}</span>
      </div>
      <div class="meta-item" style="grid-column: span 2">
        <span class="lbl">الموقع الميداني والقطع</span>
        <span class="val">${locLabel}</span>
      </div>
      <div class="meta-item">
        <span class="lbl">تاريخ الجمع والحصاد</span>
        <span class="val">${y.date || new Date().toISOString().slice(0, 10)}</span>
      </div>
      <div class="meta-item">
        <span class="lbl">مسؤول التسجيل</span>
        <span class="val">${uName}</span>
      </div>
    </div>

    <table class="grades-table">
      <thead>
        <tr>
          <th style="color:#15803d">🌟 فرز ممتاز</th>
          <th style="color:#1d4ed8">👍 فرز جيد</th>
          <th style="color:#b45309">🍂 تالف / علفي</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${ex} ${unit} <small style="color:#6b7280">(${pctEx}%)</small></td>
          <td>${gd} ${unit} <small style="color:#6b7280">(${pctGd}%)</small></td>
          <td>${bad} ${unit} <small style="color:#6b7280">(${pctBad}%)</small></td>
        </tr>
      </tbody>
    </table>

    <div class="total-banner">
      <div class="ttl-lbl">⚖️ الوزن الصافي الإجمالي للشحنة</div>
      <div class="ttl-val">${Number(total).toLocaleString()} <span style="font-size:16px">${unit}</span></div>
    </div>

    <div class="barcode-wrap">
      <svg class="barcode-svg" viewBox="0 0 240 40">
        <g fill="#111827">
          <rect x="0" y="0" width="3" height="36"/>
          <rect x="5" y="0" width="1.5" height="36"/>
          <rect x="8" y="0" width="4" height="36"/>
          <rect x="14" y="0" width="2" height="36"/>
          <rect x="18" y="0" width="3.5" height="36"/>
          <rect x="23" y="0" width="1.5" height="36"/>
          <rect x="26" y="0" width="4" height="36"/>
          <rect x="32" y="0" width="2.5" height="36"/>
          <rect x="36" y="0" width="1.5" height="36"/>
          <rect x="40" y="0" width="4" height="36"/>
          <rect x="46" y="0" width="2" height="36"/>
          <rect x="50" y="0" width="3.5" height="36"/>
          <rect x="55" y="0" width="1.5" height="36"/>
          <rect x="58" y="0" width="4.5" height="36"/>
          <rect x="65" y="0" width="2" height="36"/>
          <rect x="69" y="0" width="3" height="36"/>
          <rect x="74" y="0" width="1.5" height="36"/>
          <rect x="77" y="0" width="4" height="36"/>
          <rect x="83" y="0" width="2" height="36"/>
          <rect x="87" y="0" width="3.5" height="36"/>
          <rect x="92" y="0" width="1.5" height="36"/>
          <rect x="96" y="0" width="4" height="36"/>
          <rect x="102" y="0" width="2" height="36"/>
          <rect x="106" y="0" width="3" height="36"/>
          <rect x="111" y="0" width="1.5" height="36"/>
          <rect x="114" y="0" width="4" height="36"/>
          <rect x="120" y="0" width="2" height="36"/>
          <rect x="124" y="0" width="3.5" height="36"/>
          <rect x="130" y="0" width="1.5" height="36"/>
          <rect x="133" y="0" width="4" height="36"/>
          <rect x="139" y="0" width="2" height="36"/>
          <rect x="143" y="0" width="3" height="36"/>
          <rect x="148" y="0" width="1.5" height="36"/>
          <rect x="151" y="0" width="4" height="36"/>
          <rect x="157" y="0" width="2" height="36"/>
          <rect x="161" y="0" width="3.5" height="36"/>
          <rect x="166" y="0" width="1.5" height="36"/>
          <rect x="170" y="0" width="4" height="36"/>
          <rect x="176" y="0" width="2" height="36"/>
          <rect x="180" y="0" width="3" height="36"/>
          <rect x="185" y="0" width="1.5" height="36"/>
          <rect x="188" y="0" width="4" height="36"/>
          <rect x="194" y="0" width="2" height="36"/>
          <rect x="198" y="0" width="3.5" height="36"/>
          <rect x="203" y="0" width="1.5" height="36"/>
          <rect x="206" y="0" width="4" height="36"/>
          <rect x="212" y="0" width="2" height="36"/>
          <rect x="216" y="0" width="3" height="36"/>
          <rect x="221" y="0" width="1.5" height="36"/>
          <rect x="224" y="0" width="4" height="36"/>
          <rect x="230" y="0" width="2" height="36"/>
          <rect x="234" y="0" width="3" height="36"/>
        </g>
      </svg>
      <div style="font-family:monospace;font-size:11px;font-weight:bold;letter-spacing:2px;margin-top:2px">${batchCode}</div>
    </div>

    <div class="sig-block">
      <div>توقيع مسؤول الحصاد: ....................</div>
      <div>استلام المستودع / الميزان: ....................</div>
    </div>
  </div>

  <script>
    const batchId = ${JSON.stringify(batchCode)};
    const traceUrl = (function() {
      try {
        const origin = window.location.origin;
        const path = window.location.pathname.replace(/\\/[^\\/]*$/, '/');
        return origin + path + 'trace.html?batch=' + encodeURIComponent(batchId);
      } catch (e) {
        return 'https://bashayer.farm/trace/' + encodeURIComponent(batchId);
      }
    })();

    function drawFallbackQR(cv, text) {
      if (!cv) return;
      cv.width = 76;
      cv.height = 76;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, 76, 76);

      const N = 25;
      const cellSize = 76 / N;
      ctx.fillStyle = '#14532d';

      function cell(r, c) {
        ctx.fillRect(Math.floor(c * cellSize), Math.floor(r * cellSize), Math.ceil(cellSize), Math.ceil(cellSize));
      }

      function finder(r0, c0) {
        for (let r = 0; r < 7; r++) {
          for (let c = 0; c < 7; c++) {
            if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
              cell(r0 + r, c0 + c);
            }
          }
        }
      }

      finder(0, 0);
      finder(0, N - 7);
      finder(N - 7, 0);

      for (let i = 8; i < N - 8; i++) {
        if (i % 2 === 0) {
          cell(6, i);
          cell(i, 6);
        }
      }

      for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 5; c++) {
          if (r === 0 || r === 4 || c === 0 || c === 4 || (r === 2 && c === 2)) {
            cell(16 + r, 16 + c);
          }
        }
      }

      let h = 0x811c9dc5;
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
      }
      let seed = h >>> 0;
      function rnd() {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return (seed >>> 16) / 65536;
      }

      function isReserved(r, c) {
        if (r < 8 && c < 8) return true;
        if (r < 8 && c >= N - 8) return true;
        if (r >= N - 8 && c < 8) return true;
        if (r === 6 || c === 6) return true;
        if (r >= 16 && r <= 20 && c >= 16 && c <= 20) return true;
        return false;
      }

      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          if (!isReserved(r, c)) {
            if (rnd() > 0.52) cell(r, c);
          }
        }
      }
    }

    let qrAttempts = 0;
    function renderQR() {
      const cv = document.getElementById('qrCanvasRetail');
      if (!cv) return;
      if (typeof QRCode !== 'undefined' && QRCode.toCanvas) {
        QRCode.toCanvas(cv, traceUrl, {
          width: 76,
          margin: 1,
          color: { dark: '#14532d', light: '#ffffff' }
        }, function(error) {
          if (error) {
            console.error('QR render error:', error);
            drawFallbackQR(cv, traceUrl);
          }
        });
        return;
      }

      qrAttempts++;
      if (qrAttempts < 4) {
        setTimeout(renderQR, 250);
      } else {
        // Offline fallback
        drawFallbackQR(cv, traceUrl);
      }
    }

    function setMode(mode) {
      document.body.className = 'mode-' + mode;
      document.getElementById('btnRetail').classList.toggle('active', mode === 'retail');
      document.getElementById('btnBulk').classList.toggle('active', mode === 'bulk');
      document.getElementById('retailCard').style.display = (mode === 'retail' ? 'flex' : 'none');
      document.getElementById('bulkCard').style.display = (mode === 'bulk' ? 'flex' : 'none');
      document.getElementById('weightBox').style.display = (mode === 'retail' ? 'inline-flex' : 'none');
    }

    function updateWeight(val) {
      document.getElementById('lblNetWeight').textContent = val;
    }

    function openPassport() {
      window.open(traceUrl, '_blank');
    }

    window.addEventListener('DOMContentLoaded', () => {
      renderQR();
    });
  <\/script>
</body>
</html>`);
  w.document.close();
}
window.printHarvestBatchSticker = printHarvestBatchSticker;


