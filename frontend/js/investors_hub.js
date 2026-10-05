/**
 * PalmTrace - Investor Relations & Asset Allocation Hub (💼 المستثمرون والعقود)
 * Modular Component: Investors Directory, Comprehensive Detail View, Contracts & Plot Allocation, Excel Round-Trip Sync
 */

(function () {
  // Module State
  let invHubTab = "directory"; // "directory" | "contracts" | "excel"
  let activeInvestorDetailId = null; // When set, renders the dedicated investor detail & contracts view
  let invSearchQ = "";
  let invContractFilter = "all"; // "all" | "CROP_SHARE" | "SERVICE_FEE_SHARE"
  let invZakatFilter = "all"; // "all" | "1" | "0"
  let invSortCol = "plot_id";
  let invSortAsc = true;
  let invContractsViewMode = "cards"; // "cards" | "table"
  let showNewInvestorModal = false;
  let editingInvRecord = null;
  let showNewContractModal = false;
  let editingContractRecord = null;
  let parsedExcelInvestorRows = [];
  let excelUploadFileName = "";
  let isImportingExcel = false;

  // Helper: Format investor identifier (never display ugly raw database IDs like u_179... or u3 or uysr0um)
  function formatInvestorIdentifier(inv, index) {
    if (inv && inv.phone && inv.phone !== "—") {
      return inv.phone;
    }
    if (inv && inv.id && /^INV-\d+/i.test(inv.id)) {
      return inv.id;
    }
    return `مستثمر #${index + 1}`;
  }

  // Helper: Get comprehensive list of investors
  function getHubInvestors(st) {
    const invMap = new Map();
    (st.investors || []).forEach(inv => {
      if (inv && inv.id) invMap.set(String(inv.id), { ...inv });
    });
    // Fallback: cross-link users who have investor role
    (st.users || []).forEach(u => {
      if (u.role === "investor" || (u.roles || []).includes("investor")) {
        if (!invMap.has(String(u.id))) {
          invMap.set(String(u.id), {
            id: u.id,
            user_id: u.id,
            full_name: u.full_name || u.name || u.user,
            phone: u.phone || "—",
            email: u.email || "",
            bank_name: u.bank_name || "",
            iban: u.iban || "",
            national_id: u.national_id || ""
          });
        }
      }
    });
    return Array.from(invMap.values());
  }

  // Helper: Get contracts
  function getHubContracts(st) {
    return st.contracts || st.investmentContracts || [];
  }

  // Helper: Build plot allocations
  function getHubAllocations(st) {
    const contracts = getHubContracts(st);
    const investors = getHubInvestors(st);
    const invMap = new Map(investors.map(i => [String(i.id), i]));
    (st.users || []).forEach(u => {
      if (!invMap.has(String(u.id))) {
        invMap.set(String(u.id), { id: u.id, full_name: u.full_name || u.name || u.user, phone: u.phone || "—" });
      }
    });

    const plotsMap = new Map((st.plots || []).map(p => [String(p.id), p]));
    const contractPlots = st.contractPlots || [];

    const allocations = [];
    const processedPlotIds = new Set();

    // Helper to resolve contract model cleanly
    const resolveModel = (c) => {
      const mRaw = (c.model_type || c.modelType || c.template_id || "").toString().trim().toUpperCase();
      const fee = Number(c.service_fee_per_acre ?? c.serviceFee ?? c.annual_fee_per_acre ?? 0) || 0;
      const share = Number(c.crop_share_percentage ?? c.cropSharePct ?? c.company_crop_share_pct ?? 25.0) || 25.0;
      const isFee = (mRaw === "SERVICE_FEE_SHARE" || mRaw === "MODEL_B" || mRaw.includes("خدمة") || mRaw.includes("SERVICE")) && fee > 0;
      return {
        model_type: isFee ? "SERVICE_FEE_SHARE" : "CROP_SHARE",
        crop_share_percentage: share,
        service_fee_per_acre: isFee ? fee : 0.0
      };
    };

    // 1. Allocations from contractPlots table
    contractPlots.forEach(cp => {
      const plotId = String(cp.plot_id || cp.plotId || "");
      if (!plotId) return;
      processedPlotIds.add(plotId);

      const contractId = String(cp.contract_id || cp.contractId || "");
      const contract = contracts.find(c => String(c.id) === contractId || String(c.contract_number) === contractId || String(c.contract_num) === contractId) || {};
      const invId = String(contract.investor_id || contract.investorId || contract.investor_user_id || "");
      const investor = invMap.get(invId) || invMap.get(contract.investorUserId) || {};

      const plot = plotsMap.get(plotId) || {};
      const actualPalms = activePalmsInPlot(plotId).length;
      const allocatedPalms = Number(cp.allocated_palms_count ?? cp.palmsCount ?? contract.palms_count ?? actualPalms);
      const modelInfo = resolveModel(contract);

      allocations.push({
        plot_id: plotId,
        plot_name: plot.name || `القطعة ${plotId}`,
        sector: plot.sector || (plotId.includes("-") ? plotId.split("-")[0] : "—"),
        area: plot.areaValue || plot.area_value || plot.area || "—",
        mainCrop: plot.mainCrop || plot.main_crop || "نخيل تمر",
        contract_id: contract.id || contract.contract_number || contract.contract_num || contractId || "—",
        contract_date: contract.contract_date || contract.startDate || contract.start_date || "—",
        model_type: modelInfo.model_type,
        crop_share_percentage: modelInfo.crop_share_percentage,
        service_fee_per_acre: modelInfo.service_fee_per_acre,
        zakat_delegation: contract.zakat_delegation !== undefined ? contract.zakat_delegation : (contract.zakatDelegation !== undefined ? (contract.zakatDelegation ? 1 : 0) : 1),
        status: contract.status || "ACTIVE",
        investor_id: investor.id || invId || "—",
        investor_name: investor.full_name || investor.name || "مستثمر غير محدد",
        investor_phone: investor.phone || "—",
        allocated_palms: allocatedPalms,
        actual_palms: actualPalms
      });
    });

    // 2. Contracts with .plots array not already covered
    contracts.forEach(contract => {
      const cPlots = Array.isArray(contract.plots) ? contract.plots : [];
      cPlots.forEach(plotId => {
        plotId = String(plotId);
        if (processedPlotIds.has(plotId)) return;
        processedPlotIds.add(plotId);

        const invId = String(contract.investor_id || contract.investorId || contract.investor_user_id || "");
        const investor = invMap.get(invId) || invMap.get(contract.investorUserId) || {};
        const plot = plotsMap.get(plotId) || {};
        const actualPalms = activePalmsInPlot(plotId).length;
        const allocatedPalms = Number(contract.palms_count || contract.palmsCount || actualPalms);
        const modelInfo = resolveModel(contract);

        allocations.push({
          plot_id: plotId,
          plot_name: plot.name || `القطعة ${plotId}`,
          sector: plot.sector || (plotId.includes("-") ? plotId.split("-")[0] : "—"),
          area: plot.areaValue || plot.area_value || plot.area || "—",
          mainCrop: plot.mainCrop || plot.main_crop || "نخيل تمر",
          contract_id: contract.id || contract.contract_number || contract.contract_num || "—",
          contract_date: contract.contract_date || contract.startDate || contract.start_date || "—",
          model_type: modelInfo.model_type,
          crop_share_percentage: modelInfo.crop_share_percentage,
          service_fee_per_acre: modelInfo.service_fee_per_acre,
          zakat_delegation: contract.zakat_delegation !== undefined ? contract.zakat_delegation : (contract.zakatDelegation ? 1 : 1),
          status: contract.status || "ACTIVE",
          investor_id: investor.id || invId || "—",
          investor_name: investor.full_name || investor.name || "مستثمر غير محدد",
          investor_phone: investor.phone || "—",
          allocated_palms: allocatedPalms,
          actual_palms: actualPalms
        });
      });
    });

    return allocations;
  }

  // Main View: Investors Hub
  function investorsHubView(extra) {
    if (extra) {
      activeInvestorDetailId = String(extra);
      invHubTab = "directory";
    }
    const st = Store.get();
    const investors = getHubInvestors(st);
    const contracts = getHubContracts(st);
    const allocations = getHubAllocations(st);

    // Calculate Top KPI Metrics
    const totalInvestors = investors.length;
    const totalContracts = contracts.length;
    const totalAllocatedPlots = allocations.length;
    const totalAllocatedPalms = allocations.reduce((sum, a) => sum + (Number(a.allocated_palms) || 0), 0);
    const totalActualPalms = allocations.reduce((sum, a) => sum + (Number(a.actual_palms) || 0), 0);

    return `
      <div class="inv-hub-wrap">
        <!-- Compact Single-Row Header (No stacked buttons, no wasted vertical space) -->
        <div class="card" style="margin-bottom:0;padding:12px 18px;border-radius:12px;background:linear-gradient(135deg, #0F172A 0%, #1E293B 100%);color:#fff">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
            <div style="display:flex;align-items:center;gap:10px">
              <div style="width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:20px;border:1px solid rgba(255,255,255,0.18)">
                💼
              </div>
              <div>
                <h2 style="margin:0;font-size:16px;font-weight:800;letter-spacing:-0.01em">إدارة المستثمرين والعقود</h2>
                <div style="font-size:11.5px;color:#94A3B8;margin-top:2px">
                  سجل المستثمرين ومطابقة العقود والأصول الميدانية ومزامنة الإكسل
                </div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
              <button type="button" class="btn btn-primary" data-act="open-create-investor" style="background:#16A34A;display:inline-flex;align-items:center;gap:5px;font-weight:700;padding:6px 12px;font-size:12px;white-space:nowrap">
                <span>➕</span> إضافة مستثمر
              </button>
              <button type="button" class="btn" data-act="open-create-contract" style="background:#0284C7;color:#fff;display:inline-flex;align-items:center;gap:5px;font-weight:700;padding:6px 12px;font-size:12px;white-space:nowrap">
                <span>📜</span> ربط عقد جديد
              </button>
            </div>
          </div>
        </div>

        <!-- 4 Compact Global KPI Widgets -->
        <div class="inv-kpi-grid">
          <div class="inv-kpi-card">
            <div class="inv-kpi-icon" style="background:#EFF6FF;color:#2563EB">👥</div>
            <div>
              <div class="inv-kpi-val">${totalInvestors}</div>
              <div class="inv-kpi-lbl">إجمالي المستثمرين</div>
            </div>
          </div>
          <div class="inv-kpi-card">
            <div class="inv-kpi-icon" style="background:#FEF3C7;color:#D97706">📜</div>
            <div>
              <div class="inv-kpi-val">${totalContracts}</div>
              <div class="inv-kpi-lbl">إجمالي العقود</div>
            </div>
          </div>
          <div class="inv-kpi-card">
            <div class="inv-kpi-icon" style="background:#F0FDF4;color:#16A34A">🗺️</div>
            <div>
              <div class="inv-kpi-val">${totalAllocatedPlots}</div>
              <div class="inv-kpi-lbl">القطع المسندة</div>
            </div>
          </div>
          <div class="inv-kpi-card">
            <div class="inv-kpi-icon" style="background:#F5F3FF;color:#7C3AED">🌴</div>
            <div>
              <div class="inv-kpi-val">${totalAllocatedPalms.toLocaleString("ar-EG")} <span style="font-size:11px;color:#64748B;font-weight:normal">(الفعلي: ${totalActualPalms.toLocaleString("ar-EG")})</span></div>
              <div class="inv-kpi-lbl">إجمالي النخيل المتعاقد</div>
            </div>
          </div>
        </div>

        <!-- Zero-Scroll Tabs Navigation -->
        <div class="inv-tabs-nav">
          <button class="inv-tab-btn ${invHubTab === 'directory' ? 'active' : ''}" data-act="switch-inv-tab" data-id="directory">
            <span>👥</span> سجل المستثمرين
          </button>
          <button class="inv-tab-btn ${invHubTab === 'contracts' ? 'active' : ''}" data-act="switch-inv-tab" data-id="contracts">
            <span>📜</span> العقود وتخصيص القطع
          </button>
          <button class="inv-tab-btn ${invHubTab === 'excel' ? 'active' : ''}" data-act="switch-inv-tab" data-id="excel">
            <span>📊</span> استيراد وتصدير (Excel)
          </button>
        </div>

        <!-- Tab Body -->
        ${invHubTab === 'directory' ? (activeInvestorDetailId ? renderInvestorDetailView(activeInvestorDetailId, investors, contracts, allocations, st) : renderTabDirectory(investors, contracts, allocations, st)) : ''}
        ${invHubTab === 'contracts' ? renderTabContracts(allocations, st) : ''}
        ${invHubTab === 'excel' ? renderTabExcel(st) : ''}

        <!-- Modals -->
        ${showNewInvestorModal ? renderInvestorModal(st) : ''}
        ${showNewContractModal ? renderContractModal(st) : ''}
      </div>
    `;
  }

  // TAB 1: سجل المستثمرين (Investors Directory) - Optimized without horizontal scroll
  function renderTabDirectory(investors, contracts, allocations, st) {
    const q = invSearchQ.trim().toLowerCase();
    const filtered = investors.filter(inv => {
      if (!q) return true;
      const haystack = `${inv.id || ''} ${inv.full_name || ''} ${inv.phone || ''} ${inv.national_id || ''} ${inv.email || ''} ${inv.bank_name || ''} ${inv.iban || ''}`.toLowerCase();
      return haystack.includes(q);
    });

    return `
      <div class="card" style="border-radius:12px;padding:16px">
        <!-- Search and Summary Bar -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:240px">
            <input type="text" class="input" placeholder="🔍 بحث باسم المستثمر، رقم الجوال، أو الحساب..." 
                   value="${escapeHtml(invSearchQ)}" oninput="window.setInvSearchQ(this.value)" style="width:100%;max-width:380px" />
            ${invSearchQ ? `<button class="btn btn-ghost" style="padding:4px 8px;font-size:12px" onclick="window.setInvSearchQ('')">مسح</button>` : ''}
          </div>
          <div style="font-size:12.5px;color:#64748B">
            عدد المستثمرين: <b>${filtered.length}</b> مستثمر (انقر على اسم المستثمر لفتح ملفه وعقوده)
          </div>
        </div>

        <!-- Clean, Compact Table without horizontal scroll -->
        <div style="width:100%">
          <table class="inv-table" style="width:100%;border-collapse:collapse;text-align:right">
            <thead>
              <tr style="background:#F8FAFC;border-bottom:2px solid #E2E8F0;color:#475569;font-size:12.5px">
                <th style="padding:10px 8px;width:40px;text-align:center">#</th>
                <th style="padding:10px 10px">اسم المستثمر</th>
                <th style="padding:10px 10px">المعرف (رقم الجوال)</th>
                <th style="padding:10px 10px;text-align:center">حساب البوابة</th>
                <th style="padding:10px 10px;text-align:center">العقود</th>
                <th style="padding:10px 10px;text-align:center">القطع</th>
                <th style="padding:10px 8px;text-align:center;width:150px">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${filtered.length === 0 ? `
                <tr><td colspan="7" style="text-align:center;padding:32px;color:#94A3B8">لا توجد سجلات مستثمرين مطابقة للبحث</td></tr>
              ` : filtered.map((inv, idx) => {
                const invContracts = contracts.filter(c => String(c.investor_id || c.investorId) === String(inv.id) || String(c.investorUserId) === String(inv.id));
                const invAllocations = allocations.filter(a => String(a.investor_id) === String(inv.id));
                const displayPhone = inv.phone && inv.phone !== "—" ? inv.phone : "—";

                return `
                  <tr style="border-bottom:1px solid #F1F5F9;transition:background 0.15s ease" onmouseover="this.style.background='#F8FAFC'" onmouseout="this.style.background='transparent'">
                    <td style="padding:8px;text-align:center;font-weight:700;color:#64748B;font-size:12px">
                      ${idx + 1}
                    </td>
                    <td style="padding:8px 10px;font-weight:700;color:#0F172A">
                      <a href="javascript:void(0)" onclick="act('view-investor-detail', '${inv.id}')" style="color:#0F172A;text-decoration:none;display:flex;align-items:center;gap:6px">
                        <span>👤</span> <span style="border-bottom:1px dashed #CBD5E1">${escapeHtml(inv.full_name || inv.name || '—')}</span>
                      </a>
                    </td>
                    <td style="padding:8px 10px;direction:ltr;text-align:right;font-family:monospace;color:#2563EB;font-weight:700">
                      ${escapeHtml(displayPhone)}
                    </td>
                    <td style="padding:8px 10px;text-align:center;font-size:11.5px">
                      ${inv.user_id ? `<span class="badge" style="background:#DCFCE7;color:#166534;padding:2px 6px">مفعل ✅</span>` : `<span class="badge" style="background:#F1F5F9;color:#64748B;padding:2px 6px">غير مربوط</span>`}
                    </td>
                    <td style="padding:8px 10px;text-align:center;font-weight:700;color:#0F172A">
                      ${invContracts.length}
                    </td>
                    <td style="padding:8px 10px;text-align:center;font-weight:700;color:#0F172A">
                      ${invAllocations.length} قطعة
                    </td>
                    <td style="padding:8px;text-align:center;white-space:nowrap">
                      <div style="display:inline-flex;gap:4px;align-items:center">
                        <button type="button" class="inv-action-btn btn-contracts" data-act="view-investor-detail" data-id="${inv.id}" title="عرض تفاصيل المستثمر وعقوده وقطعه">
                          📜 العقود والتفاصيل
                        </button>
                        <button type="button" class="inv-action-btn btn-edit" data-act="edit-investor-hub" data-id="${inv.id}" title="تعديل بيانات المستثمر">
                          ✏️
                        </button>
                        <button type="button" class="inv-action-btn btn-del" data-act="del-investor-hub" data-id="${inv.id}" title="حذف المستثمر">
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // TAB 1 (Inner Page): Investor Comprehensive Detail & Contracts View
  function renderInvestorDetailView(investorId, investors, contracts, allocations, st) {
    const inv = investors.find(i => String(i.id) === String(investorId)) || { id: investorId };
    const invContracts = contracts.filter(c => String(c.investor_id || c.investorId) === String(inv.id) || String(c.investorUserId) === String(inv.id));
    const invAllocations = allocations.filter(a => String(a.investor_id) === String(inv.id));
    const totalAllocatedPalms = invAllocations.reduce((sum, a) => sum + (Number(a.allocated_palms) || 0), 0);
    const totalActualPalms = invAllocations.reduce((sum, a) => sum + (Number(a.actual_palms) || 0), 0);
    const isExact = totalAllocatedPalms === totalActualPalms;

    return `
      <div>
        <!-- Back Button Toolbar -->
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
          <button type="button" class="btn btn-ghost" data-act="back-to-investors-dir" style="font-weight:700;display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:#fff;border:1px solid #CBD5E1">
            <span>↩️</span> العودة لسجل المستثمرين
          </button>
          <div style="display:flex;gap:8px">
            <button type="button" class="btn btn-primary" data-act="open-create-contract-for-inv" data-id="${inv.id}" style="background:#0284C7;font-weight:700;padding:6px 12px;font-size:12.5px">
              ➕ إضافة عقد جديد لهذا المستثمر
            </button>
            <button type="button" class="btn btn-ghost" data-act="edit-investor-hub" data-id="${inv.id}" style="color:#D97706;font-weight:700;padding:6px 12px;font-size:12.5px;border:1px solid #FCD34D;background:#FFFBEB">
              ✏️ تعديل بيانات المستثمر
            </button>
          </div>
        </div>

        ${(() => {
          const linkedStaffUser = (st.users || []).find(u => 
            (inv.user_id && String(u.id) === String(inv.user_id)) ||
            (inv.phone && inv.phone !== "—" && u.phone && u.phone.replace(/[^0-9]/g, '') === inv.phone.replace(/[^0-9]/g, '')) ||
            String(u.id) === String(inv.id)
          );
          const isEmployee = linkedStaffUser && (linkedStaffUser.role !== 'investor' || (Array.isArray(linkedStaffUser.roles) && linkedStaffUser.roles.some(r => r !== 'investor')));
          if (!isEmployee) return '';
          const empRoleLabel = typeof roleLabel === 'function' ? roleLabel(linkedStaffUser.role) : linkedStaffUser.role;
          return `
            <div style="background:#EFF6FF;border:1.5px solid #3B82F6;border-radius:12px;padding:12px 18px;margin-bottom:14px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;box-shadow:0 2px 4px rgba(37,99,235,0.08)">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:42px;height:42px;border-radius:10px;background:#DBEAFE;display:flex;align-items:center;justify-content:center;font-size:22px;border:1px solid #BFDBFE">👔</div>
                <div>
                  <div style="font-weight:800;color:#1E3A8A;font-size:14px">
                    هذا المستثمر لديه حساب كادر عمل وتشغيل نشط بالمنظومة (${empRoleLabel} — كود الحساب: <span style="font-family:monospace;color:#1D4ED8">@${escapeHtml(linkedStaffUser.user)}</span>)
                  </div>
                  <div style="font-size:12px;color:#2563EB;margin-top:2px">
                    يمتلك صلاحيات تشغيلية ونطاق مهام ميداني لرعاية ومتابعة الحقل والنخيل.
                  </div>
                </div>
              </div>
              <button type="button" class="btn btn-primary" data-go="user-edit" data-id="${linkedStaffUser.id}" style="background:#2563EB;font-size:12.5px;padding:6px 14px;font-weight:700;display:inline-flex;align-items:center;gap:6px">
                <span>✏️</span> إدارة صلاحيات الحساب والنطاق التشغيلي ↗
              </button>
            </div>
          `;
        })()}

        <!-- Investor Comprehensive Profile Card (Contains Bank, IBAN, National ID, Palms, etc.) -->
        <div class="inv-profile-card">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <div style="display:flex;align-items:center;gap:12px">
              <div style="width:46px;height:46px;border-radius:12px;background:#F0FDF4;color:#16A34A;display:flex;align-items:center;justify-content:center;font-size:24px;border:1px solid #BBF7D0">
                👤
              </div>
              <div>
                <h3 style="margin:0;font-size:18px;color:#0F172A;font-weight:800">
                  ${escapeHtml(inv.full_name || inv.name || 'مستثمر')}
                </h3>
                <div style="font-size:12.5px;color:#64748B;margin-top:2px;display:flex;align-items:center;gap:10px">
                  <span>المعرف الأساسي: <b style="font-family:monospace;color:#2563EB">${escapeHtml(inv.phone || '—')}</b></span>
                  ${inv.user_id ? `<span class="badge" style="background:#DCFCE7;color:#166534">بوابة المستخدمين: مفعلة ✅</span>` : `<span class="badge" style="background:#F1F5F9;color:#64748B">حساب البوابة: غير مربوط</span>`}
                </div>
              </div>
            </div>
            <div style="display:flex;gap:12px">
              <div style="text-align:center;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:6px 14px">
                <div style="font-size:11px;color:#64748B">إجمالي العقود</div>
                <div style="font-size:16px;font-weight:800;color:#0F172A">${invContracts.length}</div>
              </div>
              <div style="text-align:center;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:6px 14px">
                <div style="font-size:11px;color:#64748B">القطع المخصصة</div>
                <div style="font-size:16px;font-weight:800;color:#0F172A">${invAllocations.length}</div>
              </div>
              <div style="text-align:center;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:6px 14px">
                <div style="font-size:11px;color:#64748B">النخيل المتعاقد</div>
                <div style="font-size:16px;font-weight:800;color:#16A34A">${totalAllocatedPalms.toLocaleString("ar-EG")}</div>
              </div>
            </div>
          </div>

          <!-- Detailed Information Grid (الرقم القومي، الآيبان، البنك، البريد) -->
          <div class="inv-detail-grid">
            <div class="inv-detail-item">
              <span class="inv-detail-label">🪪 الرقم القومي</span>
              <span class="inv-detail-value" style="font-family:monospace">${escapeHtml(inv.national_id || '—')}</span>
            </div>
            <div class="inv-detail-item">
              <span class="inv-detail-label">🏦 اسم البنك</span>
              <span class="inv-detail-value">${escapeHtml(inv.bank_name || '—')}</span>
            </div>
            <div class="inv-detail-item">
              <span class="inv-detail-label">💳 رقم الآيبان (IBAN)</span>
              <span class="inv-detail-value" style="font-family:monospace">${escapeHtml(inv.iban || '—')}</span>
            </div>
            <div class="inv-detail-item">
              <span class="inv-detail-label">📧 البريد الإلكتروني</span>
              <span class="inv-detail-value">${escapeHtml(inv.email || '—')}</span>
            </div>
            <div class="inv-detail-item">
              <span class="inv-detail-label">🌴 النخيل الفعلي المسجل بالحقل</span>
              <span class="inv-detail-value">
                ${totalActualPalms.toLocaleString("ar-EG")} نخلة 
                ${isExact ? `<span class="chip" style="background:#DCFCE7;color:#15803D;font-size:11px">مطابق تماماً ✅</span>` : `<span class="chip" style="background:#FEF3C7;color:#B45309;font-size:11px">فارق: ${totalActualPalms - totalAllocatedPalms}</span>`}
              </span>
            </div>
          </div>
        </div>

        <!-- Contracts & Plot Allocations Section for this Investor -->
        <div style="margin-top:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h4 style="margin:0;font-size:15px;color:#0F172A;font-weight:800">
              📜 عقود المستثمر وبطاقات مطابقة الأصول (${invAllocations.length} قطعة متعاقد عليها)
            </h4>
          </div>
          ${invAllocations.length === 0 ? `
            <div class="card" style="text-align:center;padding:36px;color:#94A3B8;border-radius:12px">
              <div>📜 لا توجد عقود أو قطع مسندة لهذا المستثمر حتى الآن</div>
              <button class="btn btn-primary" data-act="open-create-contract-for-inv" data-id="${inv.id}" style="margin-top:12px;background:#0284C7">
                ➕ إضافة وربط أول عقد وقطعة
              </button>
            </div>
          ` : renderPlotOwnerCards(invAllocations, true)}
        </div>
      </div>
    `;
  }

  // TAB 2: إدارة العقود ومطابقة الأصول (Contracts & Plot Allocation)
  function renderTabContracts(allocations, st) {
    const q = invSearchQ.trim().toLowerCase();
    let filtered = allocations.filter(a => {
      if (invContractFilter !== "all" && a.model_type !== invContractFilter) return false;
      if (invZakatFilter !== "all" && String(a.zakat_delegation) !== String(invZakatFilter)) return false;
      if (q) {
        const haystack = `${a.plot_id} ${a.plot_name} ${a.contract_id} ${a.investor_name} ${a.investor_phone} ${a.investor_id}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    // Sort allocations
    filtered.sort((x, y) => {
      let valX = x[invSortCol] || "";
      let valY = y[invSortCol] || "";
      if (typeof valX === "number" && typeof valY === "number") {
        return invSortAsc ? valX - valY : valY - valX;
      }
      valX = String(valX).toLowerCase();
      valY = String(valY).toLowerCase();
      return invSortAsc ? valX.localeCompare(valY, "ar") : valY.localeCompare(valX, "ar");
    });

    return `
      <div class="card" style="border-radius:12px;padding:16px">
        <!-- Filter & Control Bar -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;flex:1">
            <input type="text" class="input" placeholder="🔍 بحث بكود القطعة، كود العقد، المستثمر..." 
                   value="${escapeHtml(invSearchQ)}" oninput="window.setInvSearchQ(this.value)" style="min-width:200px;max-width:320px" />
            
            <select class="input" onchange="window.setInvContractFilter(this.value)" style="min-width:150px">
              <option value="all" ${invContractFilter === 'all' ? 'selected' : ''}>جميع نماذج التعاقد</option>
              <option value="CROP_SHARE" ${invContractFilter === 'CROP_SHARE' ? 'selected' : ''}>نسبة مشاركة في المحصول</option>
              <option value="SERVICE_FEE_SHARE" ${invContractFilter === 'SERVICE_FEE_SHARE' ? 'selected' : ''}>رسم خدمة سنوي للفدان</option>
            </select>

            <select class="input" onchange="window.setInvZakatFilter(this.value)" style="min-width:130px">
              <option value="all" ${invZakatFilter === 'all' ? 'selected' : ''}>جميع حالات الزكاة</option>
              <option value="1" ${invZakatFilter === '1' ? 'selected' : ''}>مفوض (خصم 5%)</option>
              <option value="0" ${invZakatFilter === '0' ? 'selected' : ''}>يخرجها بنفسه</option>
            </select>

            ${(invSearchQ || invContractFilter !== 'all' || invZakatFilter !== 'all') ? `
              <button class="btn btn-ghost" style="padding:4px 8px;font-size:12px" onclick="window.resetInvFilters()">إلغاء التصفية</button>
            ` : ''}
          </div>

          <div style="display:flex;align-items:center;gap:8px">
            <div style="background:#F1F5F9;border-radius:8px;padding:2px;display:flex;border:1px solid #E2E8F0">
              <button class="btn btn-ghost" style="padding:4px 10px;font-size:12px;border-radius:6px;${invContractsViewMode === 'cards' ? 'background:#fff;font-weight:bold;color:#0F172A;box-shadow:0 1px 2px rgba(0,0,0,0.08)' : 'color:#64748B'}" onclick="window.setInvViewMode('cards')">
                📇 بطاقات الرؤية
              </button>
              <button class="btn btn-ghost" style="padding:4px 10px;font-size:12px;border-radius:6px;${invContractsViewMode === 'table' ? 'background:#fff;font-weight:bold;color:#0F172A;box-shadow:0 1px 2px rgba(0,0,0,0.08)' : 'color:#64748B'}" onclick="window.setInvViewMode('table')">
                📊 جدول الأصول
              </button>
            </div>
            <button class="btn btn-primary" data-act="open-create-contract" style="font-weight:700;padding:6px 12px;font-size:12.5px">
              ➕ عقد وتخصيص
            </button>
          </div>
        </div>

        <!-- Active View Mode -->
        ${invContractsViewMode === 'cards' ? renderPlotOwnerCards(filtered) : renderAllocationsTable(filtered)}
      </div>
    `;
  }

  // Plot-to-Owner Card (شاشة عرض وضوح الرؤية)
  function renderPlotOwnerCards(allocations, isDetailView = false) {
    if (allocations.length === 0) {
      return `<div style="text-align:center;padding:48px;color:#94A3B8">لا توجد قطع أو عقود مطابقة للشروط الحالية</div>`;
    }

    return `
      <div class="plot-owner-cards-grid">
        ${allocations.map(a => {
          const isExact = Number(a.allocated_palms) === Number(a.actual_palms);
          const diff = Number(a.actual_palms) - Number(a.allocated_palms);
          const isDelegated = Number(a.zakat_delegation) === 1;
          const isFee = a.model_type === 'SERVICE_FEE_SHARE' && Number(a.service_fee_per_acre) > 0;
          const modelDisplay = isFee
            ? `رسم خدمة سنوي (${Number(a.service_fee_per_acre).toLocaleString("ar-EG")} ج.م/فدان)`
            : `مشاركة في المحصول (${a.crop_share_percentage}% للشركة)`;

          return `
            <div class="plot-owner-card ${isExact ? 'verified' : (diff > 0 ? 'warning' : 'danger')}">
              <!-- Header -->
              <div class="poc-header">
                <div class="poc-plot-id">
                  <span>📍</span> القطعة: <b>${escapeHtml(a.plot_id)}</b>
                </div>
                <div style="display:flex;gap:6px">
                  <span class="chip" style="background:#E0F2FE;color:#0369A1;font-weight:700;font-size:11px">📐 ${escapeHtml(a.area)} فدان</span>
                  <span class="chip" style="background:#F0FDF4;color:#166534;font-size:11px">${escapeHtml(a.mainCrop)}</span>
                </div>
              </div>

              <!-- Body matching user ASCII wireframe -->
              <div class="poc-body">
                <div class="poc-row">
                  <span class="poc-lbl">كود العقد:</span>
                  <span class="poc-val" style="font-family:monospace;color:#2563EB">📜 ${escapeHtml(a.contract_id)}</span>
                </div>
                <div class="poc-row">
                  <span class="poc-lbl">تاريخ العقد:</span>
                  <span class="poc-val">📅 ${escapeHtml(a.contract_date)}</span>
                </div>
                ${!isDetailView ? `
                <div class="poc-row" style="border-top:1px dashed #E2E8F0;padding-top:6px">
                  <span class="poc-lbl">المستثمر:</span>
                  <span class="poc-val" style="font-weight:800;color:#0F172A">
                    👤 <a href="javascript:void(0)" onclick="act('view-investor-detail', '${a.investor_id}')" style="color:#0F172A;text-decoration:underline">${escapeHtml(a.investor_name)}</a>
                  </span>
                </div>
                <div class="poc-row">
                  <span class="poc-lbl">الجوال:</span>
                  <span class="poc-val" style="direction:ltr;font-family:monospace">📞 ${escapeHtml(a.investor_phone)}</span>
                </div>
                ` : ''}
                <div class="poc-row" style="${!isDetailView ? 'border-top:1px dashed #E2E8F0;' : ''}padding-top:6px">
                  <span class="poc-lbl">نموذج التعاقد:</span>
                  <span class="poc-val" style="color:#B45309;font-weight:700">
                    ${modelDisplay}
                  </span>
                </div>
                <div class="poc-row">
                  <span class="poc-lbl">تفويض الزكاة:</span>
                  <span class="poc-val">
                    ${isDelegated ? `<span class="badge" style="background:#DCFCE7;color:#15803D">مفوض (خصم 5%) ✅</span>` : `<span class="badge" style="background:#FEF3C7;color:#92400E">يخرجها بنفسه ✋</span>`}
                  </span>
                </div>

                <!-- Tree reconciliation status -->
                <div class="poc-tree-match-box">
                  <div>
                    <div style="font-size:11px;color:#64748B">المتعاقد عليه: <b>${a.allocated_palms} نخلة</b></div>
                    <div style="font-size:11px;color:#64748B">الفعلي المسجل: <b>${a.actual_palms} نخلة</b></div>
                  </div>
                  <div>
                    ${isExact ? `
                      <span class="chip" style="background:#DCFCE7;color:#15803D;font-weight:800">مطابق تماماً ✅</span>
                    ` : (diff > 0 ? `
                      <span class="chip" style="background:#FEF3C7;color:#B45309;font-weight:800">⚠️ زيادة: +${diff}</span>
                    ` : `
                      <span class="chip" style="background:#FEE2E2;color:#B91C1C;font-weight:800">⚠️ عجز: ${diff}</span>
                    `)}
                  </div>
                </div>
              </div>

              <!-- Footer Actions -->
              <div class="poc-footer">
                <button type="button" class="inv-action-btn" style="color:#0284C7" data-act="focus-plot-gis" data-id="${a.plot_id}" title="عرض وتحديد على الخريطة">
                  🗺️ الخريطة
                </button>
                <button type="button" class="inv-action-btn" style="color:#16A34A" data-act="go-plot-detail" data-id="${a.plot_id}" title="عرض تفاصيل القطعة وأشجارها">
                  🌴 القطعة
                </button>
                <button type="button" class="inv-action-btn btn-edit" data-act="edit-contract-hub" data-id="${a.contract_id}" title="تعديل العقد وإسناد القطع">
                  ✏️ تعديل العقد
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  // Sortable Allocations Table
  function renderAllocationsTable(allocations) {
    const sortIcon = (col) => invSortCol === col ? (invSortAsc ? " ▲" : " ▼") : "";

    return `
      <div style="overflow-x:auto">
        <table class="inv-table" style="width:100%;border-collapse:collapse;text-align:right;font-size:12.5px">
          <thead>
            <tr style="background:#F8FAFC;border-bottom:2px solid #E2E8F0;color:#475569">
              <th style="padding:8px 10px;cursor:pointer" onclick="window.sortInvTable('plot_id')">كود القطعة${sortIcon('plot_id')}</th>
              <th style="padding:8px 10px;cursor:pointer" onclick="window.sortInvTable('plot_name')">اسم القطعة${sortIcon('plot_name')}</th>
              <th style="padding:8px 10px;cursor:pointer" onclick="window.sortInvTable('contract_id')">كود العقد${sortIcon('contract_id')}</th>
              <th style="padding:8px 10px;cursor:pointer" onclick="window.sortInvTable('contract_date')">تاريخ العقد${sortIcon('contract_date')}</th>
              <th style="padding:8px 10px;cursor:pointer" onclick="window.sortInvTable('investor_name')">المستثمر${sortIcon('investor_name')}</th>
              <th style="padding:8px 10px">الجوال</th>
              <th style="padding:8px 10px">نموذج التعاقد</th>
              <th style="padding:8px 10px;text-align:center">تفويض الزكاة</th>
              <th style="padding:8px 10px;text-align:center;cursor:pointer" onclick="window.sortInvTable('allocated_palms')">المتعاقد${sortIcon('allocated_palms')}</th>
              <th style="padding:8px 10px;text-align:center;cursor:pointer" onclick="window.sortInvTable('actual_palms')">الفعلي بالحقل${sortIcon('actual_palms')}</th>
              <th style="padding:8px 10px;text-align:center">المطابقة</th>
              <th style="padding:8px 10px;text-align:center">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${allocations.length === 0 ? `
              <tr><td colspan="12" style="text-align:center;padding:36px;color:#94A3B8">لا توجد سجلات مطابقة للبحث والتصفية</td></tr>
            ` : allocations.map(a => {
              const isExact = Number(a.allocated_palms) === Number(a.actual_palms);
              const diff = Number(a.actual_palms) - Number(a.allocated_palms);

              return `
                <tr style="border-bottom:1px solid #F1F5F9">
                  <td style="padding:8px 10px;font-weight:800;color:#0F172A;font-family:monospace">${escapeHtml(a.plot_id)}</td>
                  <td style="padding:8px 10px;color:#334155">${escapeHtml(a.plot_name)}</td>
                  <td style="padding:8px 10px;font-family:monospace;color:#2563EB;font-weight:700">${escapeHtml(a.contract_id)}</td>
                  <td style="padding:8px 10px;color:#64748B">${escapeHtml(a.contract_date)}</td>
                  <td style="padding:8px 10px;font-weight:700;color:#0F172A">
                    <a href="javascript:void(0)" onclick="act('view-investor-detail', '${a.investor_id}')" style="color:#0F172A;text-decoration:none">${escapeHtml(a.investor_name)}</a>
                  </td>
                  <td style="padding:8px 10px;direction:ltr;text-align:right;font-family:monospace;color:#475569">${escapeHtml(a.investor_phone)}</td>
                  <td style="padding:8px 10px;font-size:11.5px;color:#B45309;font-weight:700">
                    ${a.model_type === 'SERVICE_FEE_SHARE' && Number(a.service_fee_per_acre) > 0 ? `رسم فدان (${Number(a.service_fee_per_acre).toLocaleString('ar-EG')} ج.م)` : `مشاركة (${a.crop_share_percentage}%)`}
                  </td>
                  <td style="padding:8px 10px;text-align:center">
                    ${Number(a.zakat_delegation) === 1 ? `<span class="badge" style="background:#DCFCE7;color:#166534;font-size:11px">مفوض (5%)</span>` : `<span class="badge" style="background:#FEF3C7;color:#92400E;font-size:11px">بنفسه</span>`}
                  </td>
                  <td style="padding:8px 10px;text-align:center;font-weight:800;color:#0F172A">${a.allocated_palms}</td>
                  <td style="padding:8px 10px;text-align:center;font-weight:800;color:#15803D">${a.actual_palms}</td>
                  <td style="padding:8px 10px;text-align:center">
                    ${isExact ? `<span class="chip" style="background:#DCFCE7;color:#15803D;font-weight:700;font-size:11px">مطابق ✅</span>` : `<span class="chip" style="background:#FEF3C7;color:#B45309;font-weight:700;font-size:11px">${diff > 0 ? `+${diff}` : diff}</span>`}
                  </td>
                  <td style="padding:8px 10px;text-align:center;white-space:nowrap">
                    <button type="button" class="inv-action-btn" style="color:#0284C7" data-act="focus-plot-gis" data-id="${a.plot_id}" title="الخريطة">🗺️</button>
                    <button type="button" class="inv-action-btn btn-edit" data-act="edit-contract-hub" data-id="${a.contract_id}" title="تعديل">✏️</button>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  // TAB 3: مركز الاستيراد والتصدير الدائري (Excel Round-Trip Sync)
  function renderTabExcel(st) {
    return `
      <div class="excel-sync-box">
        <!-- Explanatory Header -->
        <div style="background:#EFF6FF;border:1px solid #BFDBFE;border-radius:12px;padding:14px;margin-bottom:20px">
          <div style="display:flex;align-items:flex-start;gap:10px">
            <span style="font-size:22px">🔄</span>
            <div>
              <h4 style="margin:0 0 4px;color:#1E40AF;font-size:14.5px">نظام المطابقة والاستيراد والتصدير الدائري المغلق (Round-Trip Excel Engine)</h4>
              <p style="margin:0;font-size:12.5px;color:#1E3A8A;line-height:1.5">
                تنزيل قالب الإكسل المعياري أو تصدير الواقع الميداني الحالي بالكامل، وتعديله بحرية، ثم إعادة رفعه دفعة واحدة داخل <b>معاملة ذرية (Database Transaction)</b> تمنع التكرار وتحدث بيانات المستثمرين، العقود، والقطع المسندة مع <b>الحساب التلقائي لعدد النخيل</b>.
              </p>
            </div>
          </div>
        </div>

        <!-- 3 Feature Cards -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:14px;margin-bottom:20px">
          
          <!-- Card 1: Download Standard Template -->
          <div class="card" style="border:1.5px solid #E2E8F0;border-radius:12px;padding:16px;display:flex;flex-direction:column;justify-content:space-between">
            <div>
              <div style="width:36px;height:36px;border-radius:8px;background:#F0FDF4;color:#16A34A;display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:10px">
                📥
              </div>
              <h4 style="margin:0 0 4px;font-size:15px;color:#0F172A">1. تنزيل القالب المعياري الفارغ</h4>
              <p style="margin:0 0 10px;font-size:12px;color:#64748B;line-height:1.4">
                قالب إكسل (.xlsx) مجهز بالأعمدة العشرة الرسمية مع صفوف توضيحية.
              </p>
              <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:6px 8px;font-size:10.5px;color:#475569;margin-bottom:14px;line-height:1.3">
                <b>الأعمدة:</b> كود المستثمر | اسم المستثمر | رقم الجوال | كود العقد | تاريخ العقد | نموذج التعاقد | رسم الفدان (ج.م) | تفويض الزكاة | كود القطعة | عدد النخيل
              </div>
            </div>
            <button type="button" class="btn" data-act="dl-inv-template" style="background:#16A34A;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 12px;font-size:12.5px">
              <span>📥</span> تنزيل القالب النموذجي (.xlsx)
            </button>
          </div>

          <!-- Card 2: Export Current State -->
          <div class="card" style="border:1.5px solid #E2E8F0;border-radius:12px;padding:16px;display:flex;flex-direction:column;justify-content:space-between">
            <div>
              <div style="width:36px;height:36px;border-radius:8px;background:#EFF6FF;color:#2563EB;display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:10px">
                📤
              </div>
              <h4 style="margin:0 0 4px;font-size:15px;color:#0F172A">2. تصدير الواقع الميداني الحالي</h4>
              <p style="margin:0 0 10px;font-size:12px;color:#64748B;line-height:1.4">
                تصدير كافة المستثمرين والعقود والقطع الحالية بنفس صياغة القالب للتعديل السريع.
              </p>
              <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:6px 8px;font-size:10.5px;color:#475569;margin-bottom:14px;line-height:1.3">
                تتضمن كل قطعة عدد أشجار النخيل الفعلي الحالي المسجل في قاعدة البيانات.
              </div>
            </div>
            <button type="button" class="btn" data-act="export-inv-excel" style="background:#2563EB;color:#fff;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px;padding:8px 12px;font-size:12.5px">
              <span>📤</span> تصدير البيانات بالكامل (.xlsx)
            </button>
          </div>

          <!-- Card 3: Round-Trip Features -->
          <div class="card" style="border:1.5px solid #E2E8F0;border-radius:12px;padding:16px;display:flex;flex-direction:column;justify-content:space-between;background:#FAF5FF">
            <div>
              <div style="width:36px;height:36px;border-radius:8px;background:#F3E8FF;color:#9333EA;display:flex;align-items:center;justify-content:center;font-size:18px;margin-bottom:10px">
                ⚡
              </div>
              <h4 style="margin:0 0 4px;font-size:15px;color:#581C87">3. ذكاء المطابقة الآلية</h4>
              <ul style="margin:0 0 10px;padding-right:16px;font-size:11.5px;color:#6B21A8;line-height:1.5">
                <li><b>تعدد القطع:</b> تكرار كود العقد يربط عدة قطع لنفس العقد بسلاسة.</li>
                <li><b>احتساب النخيل:</b> ترك خانة النخيل فارغة يحسب الأشجار الفعلية آلياً.</li>
                <li><b>معاملة ذرية:</b> تمنع تضارب القطع وتحدث السجلات بشكل محكم.</li>
              </ul>
            </div>
            <div style="font-size:11.5px;color:#7E22CE;font-weight:bold;text-align:center">
              جاهز لمعالجة الملفات الكبيرة والسريعة
            </div>
          </div>
        </div>

        <!-- Drag & Drop Upload Zone -->
        <div class="excel-dropzone" id="inv-excel-dropzone" onclick="document.getElementById('inv-excel-file-input').click()" style="padding:22px 16px">
          <input type="file" id="inv-excel-file-input" accept=".xlsx, .xls, .csv" style="display:none" onchange="window.handleInvExcelFileSelected(event)" />
          <div style="font-size:32px;margin-bottom:6px">☁️</div>
          <div style="font-size:15px;font-weight:800;color:#0F172A">اسحب وأفلت ملف الإكسل هنا، أو انقر لاختيار الملف</div>
          <div style="font-size:12px;color:#64748B;margin-top:2px">يدعم صيغ Excel (.xlsx, .xls) و CSV مع التحقق الفوري من صحة الأعمدة</div>
        </div>

        <!-- Live Parsed Preview Grid -->
        ${parsedExcelInvestorRows.length > 0 ? renderExcelParsedPreview() : ''}
      </div>
    `;
  }

  // Preview Grid for parsed Excel rows before commit
  function renderExcelParsedPreview() {
    const rows = parsedExcelInvestorRows;
    const uniqueInvestors = new Set(rows.map(r => r.investor_id || r.id)).size;
    const uniqueContracts = new Set(rows.map(r => r.contract_id)).size;
    const uniquePlots = new Set(rows.map(r => r.plot_id)).size;

    return `
      <div style="margin-top:20px;border:1px solid #CBD5E1;border-radius:12px;padding:16px;background:#F8FAFC">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px">
          <div>
            <h4 style="margin:0;font-size:15px;color:#0F172A">
              🔍 معاينة البيانات المقروءة: <span style="color:#2563EB">${escapeHtml(excelUploadFileName)}</span>
            </h4>
            <div style="font-size:12px;color:#64748B;margin-top:2px">
              الصفوف: <b>${rows.length}</b> | المستثمرون: <b>${uniqueInvestors}</b> | العقود: <b>${uniqueContracts}</b> | القطع: <b>${uniquePlots}</b>
            </div>
          </div>
          <div style="display:flex;gap:6px">
            <button type="button" class="btn btn-ghost" style="padding:6px 10px;font-size:12px" onclick="window.clearInvParsedExcel()">إلغاء</button>
            <button type="button" class="btn btn-primary" data-act="execute-inv-excel-import" ${isImportingExcel ? 'disabled' : ''} style="background:#16A34A;font-weight:800;display:inline-flex;align-items:center;gap:6px;padding:6px 14px;font-size:12.5px">
              <span>🚀</span> ${isImportingExcel ? 'جاري المعالجة والمطابقة...' : 'بدء المطابقة وتحديث النظام دفعة واحدة'}
            </button>
          </div>
        </div>

        <div style="overflow-x:auto;max-height:300px;overflow-y:auto;border:1px solid #E2E8F0;border-radius:8px;background:#fff">
          <table class="inv-table" style="width:100%;border-collapse:collapse;text-align:right;font-size:12px">
            <thead>
              <tr style="background:#F1F5F9;border-bottom:1px solid #CBD5E1;color:#475569;position:sticky;top:0">
                <th style="padding:6px 8px">#</th>
                <th style="padding:6px 8px">كود المستثمر</th>
                <th style="padding:6px 8px">اسم المستثمر</th>
                <th style="padding:6px 8px">رقم الجوال</th>
                <th style="padding:6px 8px">كود العقد</th>
                <th style="padding:6px 8px">تاريخ العقد</th>
                <th style="padding:6px 8px">نموذج التعاقد</th>
                <th style="padding:6px 8px">تفويض الزكاة</th>
                <th style="padding:6px 8px">كود القطعة</th>
                <th style="padding:6px 8px;text-align:center">عدد النخيل</th>
              </tr>
            </thead>
            <tbody>
              ${rows.slice(0, 50).map((r, i) => `
                <tr style="border-bottom:1px solid #F1F5F9">
                  <td style="padding:6px 8px;color:#94A3B8">${i + 1}</td>
                  <td style="padding:6px 8px;font-family:monospace;font-weight:bold">${escapeHtml(r.investor_id || '')}</td>
                  <td style="padding:6px 8px;font-weight:700">${escapeHtml(r.full_name || '')}</td>
                  <td style="padding:6px 8px;font-family:monospace">${escapeHtml(r.phone || '')}</td>
                  <td style="padding:6px 8px;font-family:monospace;color:#2563EB">${escapeHtml(r.contract_id || '')}</td>
                  <td style="padding:6px 8px">${escapeHtml(r.contract_date || '')}</td>
                  <td style="padding:6px 8px">${escapeHtml(r.model_type || '')}</td>
                  <td style="padding:6px 8px">${escapeHtml(r.zakat_delegation || '')}</td>
                  <td style="padding:6px 8px;font-weight:bold;color:#15803D">${escapeHtml(r.plot_id || '')}</td>
                  <td style="padding:6px 8px;text-align:center">${r.palms_count !== undefined && r.palms_count !== '' ? r.palms_count : '<i style="color:#94A3B8">تلقائي من الحقل</i>'}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Modal: Add / Edit Investor
  function renderInvestorModal(st) {
    const inv = editingInvRecord || {};
    const isEdit = Boolean(inv.id && !inv._isNew);

    return `
      <div class="custom-modal-backdrop" onclick="if(event.target===this)window.closeInvModal()">
        <div class="custom-modal-box" style="width:100%;max-width:520px;padding:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid #E2E8F0;padding-bottom:10px">
            <h3 style="margin:0;font-size:16px;color:#0F172A">
              ${isEdit ? '✏️ تعديل بيانات المستثمر' : '➕ إضافة مستثمر جديد'}
            </h3>
            <button type="button" class="icon-btn" onclick="window.closeInvModal()" style="border:none;background:transparent;font-size:18px;cursor:pointer">✕</button>
          </div>

          <form id="investor-form" onsubmit="event.preventDefault();window.saveInvestorForm(this);">
            <input type="hidden" name="id" value="${escapeHtml(inv.id || ('inv_' + Date.now()))}" />

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
              <div>
                <label class="field-label-sm">اسم المستثمر الكامل *</label>
                <input type="text" name="full_name" class="input" value="${escapeHtml(inv.full_name || inv.name || '')}" placeholder="الاسم ثلاثي أو رباعي" required />
              </div>
              <div>
                <label class="field-label-sm">رقم الجوال (المعرف) *</label>
                <input type="tel" name="phone" class="input" value="${escapeHtml(inv.phone || '')}" placeholder="010xxxxxxxx" required />
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
              <div>
                <label class="field-label-sm">الرقم القومي</label>
                <input type="text" name="national_id" class="input" value="${escapeHtml(inv.national_id || '')}" placeholder="14 رقم" />
              </div>
              <div>
                <label class="field-label-sm">البريد الإلكتروني</label>
                <input type="email" name="email" class="input" value="${escapeHtml(inv.email || '')}" placeholder="investor@example.com" />
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
              <div>
                <label class="field-label-sm">اسم البنك</label>
                <input type="text" name="bank_name" class="input" value="${escapeHtml(inv.bank_name || '')}" placeholder="مثال: البنك الأهلي" />
              </div>
              <div>
                <label class="field-label-sm">رقم الآيبان (IBAN)</label>
                <input type="text" name="iban" class="input" value="${escapeHtml(inv.iban || '')}" placeholder="EGxxxxxxxxxxxx" />
              </div>
            </div>

            <div style="margin-bottom:16px">
              <label class="field-label-sm">ربط بحساب مستخدم بالبوابة (اختياري)</label>
              <select name="user_id" class="input">
                <option value="">— غير مربوط بحساب حالياً —</option>
                ${(st.users || []).filter(u => u.role === 'investor' || (u.roles || []).includes('investor')).map(u => `
                  <option value="${u.id}" ${inv.user_id === u.id ? 'selected' : ''}>${escapeHtml(u.full_name || u.name || u.user)} (@${escapeHtml(u.user)})</option>
                `).join("")}
              </select>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #E2E8F0;padding-top:12px">
              <button type="button" class="btn btn-ghost" onclick="window.closeInvModal()">إلغاء</button>
              <button type="submit" class="btn btn-primary" style="background:#16A34A;font-weight:700">
                💾 حفظ بيانات المستثمر
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // Modal: Add / Edit Contract & Allocation
  function renderContractModal(st) {
    const cnt = editingContractRecord || {};
    const isEdit = Boolean(cnt.id && !cnt._isNew);
    const investors = getHubInvestors(st);
    const allPlots = st.plots || [];

    // Get plots already attached to this contract
    const contractPlots = (st.contractPlots || []).filter(cp => String(cp.contract_id || cp.contractId) === String(cnt.id));
    const assignedPlotIds = new Set(contractPlots.map(cp => String(cp.plot_id || cp.plotId)));
    if (Array.isArray(cnt.plots)) {
      cnt.plots.forEach(p => assignedPlotIds.add(String(p)));
    }

    return `
      <div class="custom-modal-backdrop" onclick="if(event.target===this)window.closeContractModal()">
        <div class="custom-modal-box" style="width:100%;max-width:600px;max-height:88vh;overflow-y:auto;padding:20px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;border-bottom:1px solid #E2E8F0;padding-bottom:10px">
            <h3 style="margin:0;font-size:16px;color:#0F172A">
              ${isEdit ? '✏️ تعديل العقد وإسناد القطع' : '➕ إضافة عقد استثماري وإسناد قطع'}
            </h3>
            <button type="button" class="icon-btn" onclick="window.closeContractModal()" style="border:none;background:transparent;font-size:18px;cursor:pointer">✕</button>
          </div>

          <form id="contract-form" onsubmit="event.preventDefault();window.saveContractForm(this);">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
              <div>
                <label class="field-label-sm">كود العقد *</label>
                <input type="text" name="id" class="input" value="${escapeHtml(cnt.id || cnt.contract_num || ('CON-2026-' + String(Date.now()).slice(-3)))}" ${isEdit ? 'readonly style="background:#F1F5F9"' : ''} required />
              </div>
              <div>
                <label class="field-label-sm">المستثمر المتعاقد *</label>
                <select name="investor_id" class="input" required>
                  <option value="">— اختر المستثمر —</option>
                  ${investors.map((inv, idx) => `
                    <option value="${inv.id}" ${String(cnt.investor_id || cnt.investorId) === String(inv.id) ? 'selected' : ''}>
                      ${escapeHtml(inv.full_name || inv.name)} (${inv.phone || ('#' + (idx + 1))})
                    </option>
                  `).join("")}
                </select>
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
              <div>
                <label class="field-label-sm">تاريخ التعاقد *</label>
                <input type="date" name="contract_date" class="input" value="${cnt.contract_date || cnt.startDate || new Date().toISOString().slice(0,10)}" required />
              </div>
              <div>
                <label class="field-label-sm">حالة العقد</label>
                <select name="status" class="input">
                  <option value="ACTIVE" ${cnt.status === 'ACTIVE' || !cnt.status ? 'selected' : ''}>ساري ونشط (ACTIVE)</option>
                  <option value="EXPIRED" ${cnt.status === 'EXPIRED' ? 'selected' : ''}>منتهي (EXPIRED)</option>
                  <option value="TERMINATED" ${cnt.status === 'TERMINATED' ? 'selected' : ''}>مفسوخ (TERMINATED)</option>
                </select>
              </div>
            </div>

            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;padding:12px;margin-bottom:12px">
              <label class="field-label-sm" style="color:#0F172A;font-weight:700">نموذج الاستثمار والتعاقد</label>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:6px">
                <div>
                  <select name="model_type" class="input" id="cnt_model_type" onchange="window.toggleContractModelFields(this.value)">
                    <option value="CROP_SHARE" ${cnt.model_type !== 'SERVICE_FEE_SHARE' ? 'selected' : ''}>نسبة مشاركة في المحصول</option>
                    <option value="SERVICE_FEE_SHARE" ${cnt.model_type === 'SERVICE_FEE_SHARE' ? 'selected' : ''}>رسم خدمة سنوي للفدان</option>
                  </select>
                </div>
                <div id="cnt_crop_share_wrap" style="${cnt.model_type === 'SERVICE_FEE_SHARE' && (Number(cnt.service_fee_per_acre) > 0) ? 'display:none' : 'display:block'}">
                  <input type="number" step="0.5" name="crop_share_percentage" class="input" value="${cnt.crop_share_percentage ?? 25.0}" placeholder="نسبة الشركة % (افتراضي 25%)" />
                </div>
                <div id="cnt_service_fee_wrap" style="${cnt.model_type === 'SERVICE_FEE_SHARE' && (Number(cnt.service_fee_per_acre) > 0) ? 'display:block' : 'display:none'}">
                  <input type="number" step="100" name="service_fee_per_acre" class="input" value="${cnt.service_fee_per_acre ?? 0}" placeholder="رسم الفدان السنوي (ج.م)" />
                </div>
              </div>
            </div>

            <div style="margin-bottom:12px">
              <label class="field-label-sm">تفويض إخراج الزكاة</label>
              <select name="zakat_delegation" class="input">
                <option value="1" ${cnt.zakat_delegation !== 0 ? 'selected' : ''}>مفوض للشركة (خصم 5% من المحصول) ✅</option>
                <option value="0" ${cnt.zakat_delegation === 0 ? 'selected' : ''}>يخرجها بنفسه (عدم الخصم من المحصول) ✋</option>
              </select>
            </div>

            <!-- Plot Allocation Section -->
            <div style="border:1px solid #CBD5E1;border-radius:8px;padding:12px;background:#fff;margin-bottom:14px">
              <label class="field-label-sm" style="color:#0F172A;font-weight:800;display:flex;justify-content:space-between">
                <span>🗺️ القطع المسندة لهذا العقد</span>
                <span style="font-size:11px;color:#64748B">اختر القطع المسندة</span>
              </label>
              <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(140px, 1fr));gap:6px;max-height:140px;overflow-y:auto;margin-top:6px;padding:2px">
                ${allPlots.map(pl => {
                  const isChecked = assignedPlotIds.has(String(pl.id));
                  const treeCount = activePalmsInPlot(pl.id).length;
                  return `
                    <label style="display:flex;align-items:center;gap:6px;font-size:11.5px;background:#F8FAFC;border:1px solid ${isChecked ? '#86EFAC' : '#E2E8F0'};border-radius:6px;padding:5px;cursor:pointer">
                      <input type="checkbox" name="allocated_plots" value="${pl.id}" ${isChecked ? 'checked' : ''} />
                      <div>
                        <b>${pl.id}</b>
                        <div style="font-size:10px;color:#64748B">${pl.name || ''} (${treeCount} نخلة)</div>
                      </div>
                    </label>
                  `;
                }).join("")}
              </div>
            </div>

            <div style="margin-bottom:14px">
              <label class="field-label-sm">ملاحظات العقد</label>
              <textarea name="notes" class="input" rows="2" placeholder="أي شروط أو بنود إضافية...">${escapeHtml(cnt.notes || '')}</textarea>
            </div>

            <div style="display:flex;justify-content:flex-end;gap:8px;border-top:1px solid #E2E8F0;padding-top:12px">
              <button type="button" class="btn btn-ghost" onclick="window.closeContractModal()">إلغاء</button>
              <button type="submit" class="btn btn-primary" style="background:#0284C7;font-weight:700">
                💾 حفظ العقد وتخصيص القطع
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  // Window Helpers & Action Dispatcher
  window.setInvSearchQ = function (q) {
    invSearchQ = q || "";
    render();
  };

  window.setInvContractFilter = function (f) {
    invContractFilter = f || "all";
    render();
  };

  window.setInvZakatFilter = function (f) {
    invZakatFilter = f || "all";
    render();
  };

  window.resetInvFilters = function () {
    invSearchQ = "";
    invContractFilter = "all";
    invZakatFilter = "all";
    render();
  };

  window.setInvViewMode = function (mode) {
    invContractsViewMode = mode || "cards";
    render();
  };

  window.sortInvTable = function (col) {
    if (invSortCol === col) {
      invSortAsc = !invSortAsc;
    } else {
      invSortCol = col;
      invSortAsc = true;
    }
    render();
  };

  window.closeInvModal = function () {
    showNewInvestorModal = false;
    editingInvRecord = null;
    render();
  };

  window.closeContractModal = function () {
    showNewContractModal = false;
    editingContractRecord = null;
    render();
  };

  window.toggleContractModelFields = function (model) {
    const cropWrap = document.getElementById("cnt_crop_share_wrap");
    const servWrap = document.getElementById("cnt_service_fee_wrap");
    if (model === "SERVICE_FEE_SHARE") {
      if (cropWrap) cropWrap.style.display = "none";
      if (servWrap) servWrap.style.display = "block";
    } else {
      if (cropWrap) cropWrap.style.display = "block";
      if (servWrap) servWrap.style.display = "none";
    }
  };

  window.saveInvestorForm = async function (form) {
    const formData = new FormData(form);
    const data = {
      id: formData.get("id").trim(),
      fullName: formData.get("full_name").trim(),
      phone: formData.get("phone").trim(),
      nationalId: formData.get("national_id").trim(),
      email: formData.get("email").trim(),
      bankName: formData.get("bank_name").trim(),
      iban: formData.get("iban").trim(),
      userId: formData.get("user_id").trim() || null
    };

    if (typeof Api !== "undefined" && typeof Api.createInvestor === "function") {
      const res = await Api.createInvestor(data);
      if (res && res.error) return toast("⚠️ " + res.error);
    } else {
      const st = Store.get();
      st.investors = st.investors || [];
      const idx = st.investors.findIndex(i => i.id === data.id);
      if (idx >= 0) st.investors[idx] = { ...st.investors[idx], ...data };
      else st.investors.push(data);
      Store.save(st);
    }

    toast("✅ تم حفظ بيانات المستثمر بنجاح");
    window.closeInvModal();
  };

  window.saveContractForm = async function (form) {
    const formData = new FormData(form);
    const contractId = formData.get("id").trim();
    const investorId = formData.get("investor_id");
    const contractDate = formData.get("contract_date");
    const modelType = formData.get("model_type");
    const cropShare = Number(formData.get("crop_share_percentage")) || 25.0;
    const serviceFee = Number(formData.get("service_fee_per_acre")) || 0.0;
    const zakatDelegation = Number(formData.get("zakat_delegation"));
    const status = formData.get("status") || "ACTIVE";
    const notes = formData.get("notes") || "";

    const selectedPlots = [];
    form.querySelectorAll("input[name='allocated_plots']:checked").forEach(cb => {
      selectedPlots.push(cb.value);
    });

    const st = Store.get();
    st.contracts = st.contracts || [];
    st.contractPlots = st.contractPlots || [];

    // Save contract object
    const contractObj = {
      id: contractId,
      contract_number: contractId,
      investor_id: investorId,
      contract_date: contractDate,
      model_type: modelType,
      crop_share_percentage: cropShare,
      service_fee_per_acre: serviceFee,
      zakat_delegation: zakatDelegation,
      status: status,
      notes: notes,
      plots: selectedPlots
    };

    const cIdx = st.contracts.findIndex(c => String(c.id) === contractId || String(c.contract_number) === contractId);
    if (cIdx >= 0) st.contracts[cIdx] = { ...st.contracts[cIdx], ...contractObj };
    else st.contracts.push(contractObj);

    // Update contract_plots
    st.contractPlots = st.contractPlots.filter(cp => String(cp.contract_id || cp.contractId) !== contractId);
    selectedPlots.forEach(plotId => {
      const actualPalms = activePalmsInPlot(plotId).length;
      st.contractPlots.push({
        contract_id: contractId,
        plot_id: plotId,
        allocated_palms_count: actualPalms
      });
    });

    Store.save(st);

    // If API is available, sync to backend
    if (typeof Api !== "undefined" && typeof Api.importInvestorsContracts === "function") {
      const rows = selectedPlots.map(pid => {
        const inv = st.investors?.find(i => i.id === investorId) || {};
        const actualPalms = activePalmsInPlot(pid).length;
        return {
          investor_id: investorId,
          full_name: inv.full_name || inv.name || "مستثمر",
          phone: inv.phone || "01000000000",
          contract_id: contractId,
          contract_date: contractDate,
          model_type: modelType === "CROP_SHARE" ? `نسبة مشاركة ${cropShare}%` : `رسم خدمة سنوي`,
          service_fee: serviceFee,
          zakat_delegation: zakatDelegation === 1 ? "نعم" : "لا",
          plot_id: pid,
          palms_count: actualPalms
        };
      });
      if (rows.length > 0) {
        Api.importInvestorsContracts({ rows }).catch(() => {});
      }
    }

    toast("✅ تم حفظ العقد وإسناد القطع بنجاح");
    window.closeContractModal();
  };

  window.handleInvExcelFileSelected = function (event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    excelUploadFileName = file.name;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = e.target.result;
        const workbook = typeof XLSX !== "undefined" ? XLSX.read(data, { type: "binary" }) : null;
        if (!workbook) return toast("⚠️ مكتبة XLSX غير متوفرة لقراءة الملف");

        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (!rawJson || rawJson.length === 0) {
          return toast("⚠️ ملف الإكسل فارغ أو لا يحتوي على صفوف بيانات");
        }

        // Map columns
        parsedExcelInvestorRows = rawJson.map(row => {
          return {
            investor_id: String(row["كود المستثمر"] || row["كود_المستثمر"] || row["investor_id"] || row["investorId"] || "").trim(),
            full_name: String(row["اسم المستثمر"] || row["اسم_المستثمر"] || row["full_name"] || row["name"] || "").trim(),
            phone: String(row["رقم الجوال"] || row["الجوال"] || row["الهاتف"] || row["phone"] || "").trim(),
            contract_id: String(row["كود العقد"] || row["كود_العقد"] || row["contract_id"] || row["contractId"] || "").trim(),
            contract_date: String(row["تاريخ العقد"] || row["تاريخ_العقد"] || row["contract_date"] || row["date"] || "").trim(),
            model_type: String(row["نموذج التعاقد"] || row["نموذج_التعاقد"] || row["model_type"] || "").trim(),
            service_fee: Number(row["رسم الفدان (ج.م)"] || row["رسم الفدان"] || row["service_fee"] || 0),
            zakat_delegation: String(row["تفويض الزكاة"] || row["تفويض_الزكاة"] || row["zakat_delegation"] || "نعم").trim(),
            plot_id: String(row["كود القطعة"] || row["كود_القطعة"] || row["القطعة"] || row["plot_id"] || "").trim(),
            palms_count: row["عدد النخيل"] !== "" && row["عدد النخيل"] !== undefined ? Number(row["عدد النخيل"]) : undefined
          };
        }).filter(r => r.investor_id || r.contract_id || r.plot_id);

        toast(`✅ تم قراءة ${parsedExcelInvestorRows.length} صفاً من الإكسل بنجاح`);
        render();
      } catch (err) {
        console.error("Excel parse error:", err);
        toast("❌ خطأ أثناء قراءة ملف الإكسل: " + err.message);
      }
    };
    reader.readAsBinaryString(file);
  };

  window.clearInvParsedExcel = function () {
    parsedExcelInvestorRows = [];
    excelUploadFileName = "";
    render();
  };

  // Action Dispatcher for Investors Hub
  async function handleInvestorsHubActions(name, id, el, st) {
    if (name === "switch-inv-tab") {
      invHubTab = id || "directory";
      activeInvestorDetailId = null;
      render();
      return true;
    }

    if (name === "jump-to-investor") {
      const u = (st.users || []).find(x => String(x.id) === String(id));
      const investors = getHubInvestors(st);
      let inv = investors.find(i => 
        String(i.id) === String(id) ||
        (i.user_id && String(i.user_id) === String(id)) ||
        (u && u.phone && i.phone && i.phone !== "—" && i.phone.replace(/[^0-9]/g, '') === u.phone.replace(/[^0-9]/g, ''))
      );
      activeInvestorDetailId = inv ? String(inv.id) : String(id);
      invHubTab = "directory";
      go("investors-hub", activeInvestorDetailId);
      render();
      return true;
    }

    if (name === "view-investor-detail") {
      activeInvestorDetailId = id;
      invHubTab = "directory";
      render();
      return true;
    }

    if (name === "back-to-investors-dir") {
      activeInvestorDetailId = null;
      render();
      return true;
    }

    if (name === "open-create-investor") {
      editingInvRecord = { _isNew: true };
      showNewInvestorModal = true;
      render();
      return true;
    }

    if (name === "edit-investor-hub") {
      const investors = getHubInvestors(st);
      editingInvRecord = investors.find(i => String(i.id) === String(id)) || { id };
      showNewInvestorModal = true;
      render();
      return true;
    }

    if (name === "del-investor-hub") {
      if (confirm(`هل أنت متأكد من حذف المستثمر وجميع عقوده وإلغاء تخصيص قطعه؟`)) {
        if (typeof Api !== "undefined") {
          fetch(`${Api.API_URL}/investors/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
        }
        st.investors = (st.investors || []).filter(i => String(i.id) !== String(id));
        Store.save(st);
        toast("✅ تم حذف المستثمر بنجاح");
        if (activeInvestorDetailId === id) activeInvestorDetailId = null;
        render();
      }
      return true;
    }

    if (name === "open-create-contract" || name === "open-create-contract-for-inv") {
      editingContractRecord = { 
        _isNew: true,
        investor_id: (name === "open-create-contract-for-inv" && id) ? id : ""
      };
      showNewContractModal = true;
      render();
      return true;
    }

    if (name === "edit-contract-hub") {
      const contracts = getHubContracts(st);
      editingContractRecord = contracts.find(c => String(c.id) === String(id) || String(c.contract_number) === String(id)) || { id };
      showNewContractModal = true;
      render();
      return true;
    }

    if (name === "focus-plot-gis") {
      if (typeof mapPlot !== "undefined") window.mapPlot = id;
      go("gis");
      return true;
    }

    if (name === "go-plot-detail") {
      go("plot", id);
      return true;
    }

    if (name === "dl-inv-template") {
      if (typeof XLSX !== "undefined") {
        const headers = ["كود المستثمر", "اسم المستثمر", "رقم الجوال", "كود العقد", "تاريخ العقد", "نموذج التعاقد", "رسم الفدان (ج.م)", "تفويض الزكاة", "كود القطعة", "عدد النخيل"];
        const rows = [
          headers,
          ["INV-001", "أحمد البدري", "01000000003", "CON-2026-01", "2026-01-15", "نسبة مشاركة 25%", "0", "نعم", "BSH01-02A", "40"],
          ["INV-001", "أحمد البدري", "01000000003", "CON-2026-01", "2026-01-15", "نسبة مشاركة 25%", "0", "نعم", "BSH01-02B", "35"],
          ["INV-002", "سارة المنصوري", "01123456789", "CON-2026-02", "2026-02-01", "رسم خدمة سنوي", "3000", "نعم", "BSH02-01A", ""]
        ];
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "عقود_المستثمرين_والمطابقة");
        XLSX.writeFile(wb, "PalmTrace_Investors_Contracts_Template.xlsx");
        toast("✅ تم تنزيل قالب الإكسل النموذجي بنجاح");
      } else {
        window.open("/api/investors/template", "_blank");
      }
      return true;
    }

    if (name === "export-inv-excel") {
      if (typeof XLSX !== "undefined") {
        const allocations = getHubAllocations(st);
        const headers = ["كود المستثمر", "اسم المستثمر", "رقم الجوال", "كود العقد", "تاريخ العقد", "نموذج التعاقد", "رسم الفدان (ج.م)", "تفويض الزكاة", "كود القطعة", "عدد النخيل"];
        const rows = [headers];
        allocations.forEach((a, idx) => {
          rows.push([
            a.investor_phone || a.investor_id || `INV-${idx + 1}`,
            a.investor_name,
            a.investor_phone,
            a.contract_id,
            a.contract_date,
            a.model_type === "CROP_SHARE" ? `نسبة مشاركة ${a.crop_share_percentage}%` : "رسم خدمة سنوي",
            a.service_fee_per_acre || 0,
            Number(a.zakat_delegation) === 1 ? "نعم" : "لا",
            a.plot_id,
            a.actual_palms || a.allocated_palms || 0
          ]);
        });
        const ws = XLSX.utils.aoa_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "عقود_المستثمرين_الميدانية");
        XLSX.writeFile(wb, `PalmTrace_Investors_RoundTrip_${new Date().toISOString().slice(0,10)}.xlsx`);
        toast("✅ تم تصدير بيانات المستثمرين والعقود بنجاح");
      } else {
        Auth.download("/api/investors/export", "investors_export.xlsx").catch(err => toast(err.message));
      }
      return true;
    }

    if (name === "execute-inv-excel-import") {
      if (parsedExcelInvestorRows.length === 0) return toast("⚠️ لا توجد صفوف للمعالجة");
      isImportingExcel = true;
      render();

      try {
        let success = false;
        if (typeof Api !== "undefined" && typeof Api.importInvestorsContracts === "function") {
          const res = await Api.importInvestorsContracts({ rows: parsedExcelInvestorRows });
          if (res && res.success) {
            success = true;
            await Api.bootstrap();
          } else {
            throw new Error(res?.error || "فشل الاستيراد من الخادم");
          }
        }

        if (!success) {
          // Client-side fallback transaction upsert
          parsedExcelInvestorRows.forEach(row => {
            const invId = (row.investor_id || "INV-001").trim();
            const cntId = (row.contract_id || "CON-2026-01").trim();
            const plotId = (row.plot_id || "").trim();
            const zakatDel = (row.zakat_delegation === "نعم" || row.zakat_delegation === 1 || row.zakat_delegation === "1") ? 1 : 0;

            // 1. Investor Upsert
            st.investors = st.investors || [];
            let inv = st.investors.find(i => i.id === invId);
            if (!inv) {
              inv = { id: invId, full_name: row.full_name || invId, phone: row.phone || "—" };
              st.investors.push(inv);
            } else {
              if (row.full_name) inv.full_name = row.full_name;
              if (row.phone) inv.phone = row.phone;
            }

            // 2. Contract Upsert
            st.contracts = st.contracts || [];
            let cnt = st.contracts.find(c => c.id === cntId || c.contract_number === cntId);
            const modelType = (row.model_type || "").includes("خدمة") ? "SERVICE_FEE_SHARE" : "CROP_SHARE";
            if (!cnt) {
              cnt = {
                id: cntId,
                contract_number: cntId,
                investor_id: invId,
                contract_date: row.contract_date || new Date().toISOString().slice(0,10),
                model_type: modelType,
                crop_share_percentage: row.crop_share_pct || 25.0,
                service_fee_per_acre: row.service_fee || 0,
                zakat_delegation: zakatDel,
                plots: [plotId]
              };
              st.contracts.push(cnt);
            } else {
              if (!cnt.plots) cnt.plots = [];
              if (plotId && !cnt.plots.includes(plotId)) cnt.plots.push(plotId);
            }

            // 3. Contract Plot Link
            if (plotId) {
              st.contractPlots = st.contractPlots || [];
              const actualTreeCount = activePalmsInPlot(plotId).length;
              const allocatedCount = (row.palms_count !== undefined && row.palms_count !== "") ? Number(row.palms_count) : actualTreeCount;
              st.contractPlots = st.contractPlots.filter(cp => cp.plot_id !== plotId && cp.plotId !== plotId);
              st.contractPlots.push({
                contract_id: cntId,
                plot_id: plotId,
                allocated_palms_count: allocatedCount
              });
            }
          });

          Store.save(st);
        }

        toast("🎉 تم استيراد وتحديث عقود المستثمرين ومطابقة القطع والأصول بنجاح!");
        parsedExcelInvestorRows = [];
        excelUploadFileName = "";
        invHubTab = "contracts";
      } catch (err) {
        console.error("Import error:", err);
        toast("❌ خطأ أثناء الاستيراد: " + err.message);
      } finally {
        isImportingExcel = false;
        render();
      }
      return true;
    }

    return false;
  }

  // Export to global scope
  window.openInvestorInHub = function(investorId) {
    activeInvestorDetailId = String(investorId);
    invHubTab = "directory";
    if (typeof go === "function") {
      go("investors-hub", investorId);
    }
  };
  window.investorsHubView = investorsHubView;
  window.handleInvestorsHubActions = handleInvestorsHubActions;
})();
