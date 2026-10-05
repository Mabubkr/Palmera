// PalmTrace app — Settings, translation studio, farmers, investor portal
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

function settingsView() {
  const st = Store.get();
  const activeCrops = (st.crops || []).filter(c => c.active);
  const propSources = st.propagationSourceTypes || [];
  const usageTypes = st.cropUsageTypes || [];
  const usedType = id => st.operations.some(o => o.typeId === id);
  const usedCat = id => st.operationTypes.some(t => t.catId === id && usedType(t.id));

  // 0. تبويب استوديو إدارة اللغات والترجمات
  if (setTab === "i18n") return `${settingsTabs()}${i18nStudioView()}`;

  // 0.5 تبويب قوالب التعاقدات المالية
  if (setTab === "contracts") return `${settingsTabs()}${renderContractTemplatesView()}`;

  // 0.8 تبويب إعدادات الذكاء الاصطناعي
  if (setTab === "ai") return `${settingsTabs()}${renderAiSettingsView()}`;

  // 1. تبويب هوية الشركة والمزرعة
  if (setTab === "co") {
    const companies = st.companies || [];
    const projects = st.projects || [];
    const activeProj = getActiveProject();
    const activeComp = companies.find(c => c.id === (activeProj.companyId || activeProj.company_id || st.activeCompanyId)) || companies[0] || {};

    return `${settingsTabs()}
      <div style="max-width:920px;margin:0 auto;display:flex;flex-direction:column;gap:18px">
        
        <!-- بيانات وهوية المزرعة والمنشأة (Farm & Enterprise Settings) -->
        <div class="card" style="padding:22px;border-radius:14px;box-shadow:var(--shadow);border-top:4px solid var(--green)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;padding-bottom:12px;border-bottom:1px solid var(--line);flex-wrap:wrap;gap:10px">
            <div>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:20px">🏢</span>
                <h3 style="margin:0;font-size:17.5px;font-weight:800;color:var(--text)">بيانات وهوية المزرعة والمنشأة (Farm & Enterprise Profile)</h3>
              </div>
              <div class="muted" style="font-size:12px;margin-top:3px">الهوية المؤسسية والإعدادات التشغيلية والميدانية المعتمدة للمزرعة</div>
            </div>
            <span class="badge" style="background:rgba(27,94,32,0.12);color:var(--green);font-weight:700;font-size:12.5px;padding:5px 12px">
              🌴 ${escapeHtml(activeComp.tradeName || activeComp.name || st.settings.companyName || "المنشأة الزراعية")}
            </span>
          </div>

          <!-- Logo Upload Component -->
          <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 16px;margin-bottom:18px">
            <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
              <div style="width:82px;height:82px;border-radius:12px;border:1.5px dashed ${(activeComp.logo || st.settings.logo) ? '#16A34A' : '#CBD5E1'};background:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.05)">
                ${(activeComp.logo || st.settings.logo) 
                  ? `<img src="${activeComp.logo || st.settings.logo}" style="width:100%;height:100%;object-fit:contain;padding:4px" alt="شعار المزرعة">` 
                  : `<span style="font-size:32px;color:#94A3B8">🌴</span>`}
              </div>
              <div style="flex:1;min-width:200px">
                <div style="font-weight:700;font-size:13.5px;color:var(--text);margin-bottom:3px">شعار المزرعة والمنشأة الرسمي</div>
                <div class="muted" style="font-size:11.5px;margin-bottom:10px">يظهر في ترويسة التقارير الرسمية، كروت التتبع، وشاشة الدخول.</div>
                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                  <input id="clogo" type="file" accept="image/*" style="display:none" />
                  <button type="button" class="btn btn-ghost btn-sm" data-act="trigger-logo-upload" style="border:1px solid #CBD5E1;border-radius:8px;font-size:12px;padding:5px 12px">
                    📷 ${(activeComp.logo || st.settings.logo) ? "تغيير الشعار" : "رفع الشعار"}
                  </button>
                  ${(activeComp.logo || st.settings.logo) ? `
                    <button type="button" class="btn btn-ghost btn-sm" data-act="remove-logo" style="color:#DC2626;border:1px solid #FCA5A5;border-radius:8px;font-size:12px;padding:5px 12px">
                      🗑️ إزالة الشعار
                    </button>
                  ` : ''}
                </div>
              </div>
            </div>
          </div>

          <!-- Section 1: البيانات المؤسسية -->
          <div style="font-weight:800;font-size:14px;color:var(--green);margin-bottom:10px;display:flex;align-items:center;gap:6px">
            <span>📋</span> البيانات القانونية والمؤسسية
          </div>
          <div class="grid grid-2" style="gap:14px;margin-bottom:20px">
            <div>
              <label style="font-size:12.5px;font-weight:700">اسم المنشأة والمزرعة *</label>
              <input id="coname" value="${escapeHtml(activeComp.name || st.settings.companyName || "")}" placeholder="مثال: شركة بشاير الشوربجي للاستثمار الزراعي" />
            </div>
            <div>
              <label style="font-size:12.5px;font-weight:700">الاسم التجاري / اسم المزرعة المتعارف عليه</label>
              <input id="cotradename" value="${escapeHtml(activeComp.tradeName || activeComp.trade_name || activeProj.name || "")}" placeholder="مثال: مزرعة بشاير الفرافرة" />
            </div>

            <div>
              <label style="font-size:12.5px;font-weight:700">رقم السجل التجاري (CR)</label>
              <input id="c_cr" value="${escapeHtml(activeComp.commercialRegistry || activeComp.commercial_registry || st.settings.commercialRegister || "")}" placeholder="مثال: 123456" />
            </div>
            <div>
              <label style="font-size:12.5px;font-weight:700">الرقم الضريبي (Tax ID / VAT)</label>
              <input id="c_tax" value="${escapeHtml(activeComp.taxNumber || activeComp.tax_number || st.settings.taxId || "")}" placeholder="مثال: 123-456-789" />
            </div>

            <div>
              <label style="font-size:12.5px;font-weight:700">البريد الإلكتروني المعتمد</label>
              <input id="c_email" type="email" value="${escapeHtml(activeComp.email || st.settings.officialEmail || "")}" placeholder="info@company.com" />
            </div>
            <div>
              <label style="font-size:12.5px;font-weight:700">هاتف التواصل المعتمد</label>
              <input id="c_phone" value="${escapeHtml(activeComp.phone || st.settings.officialPhone || "")}" placeholder="+20 10 1234 5678" />
            </div>

            <div>
              <label style="font-size:12.5px;font-weight:700">رمز العملة (ISO Code)</label>
              <input id="ccode" value="${escapeHtml(activeComp.currencyCode || activeComp.currency_code || st.settings.currency || "EGP")}" placeholder="EGP أو SAR أو USD" />
            </div>
            <div>
              <label style="font-size:12.5px;font-weight:700">اسم العملة بالعربية</label>
              <input id="ccurname" value="${escapeHtml(st.settings.currencyName || "جنيه مصري")}" placeholder="مثال: جنيه مصري" />
            </div>
          </div>

          <!-- Section 1.5: إعدادات صفحة تتبع المنتج والطلب المباشر والتصدير -->
          <div style="font-weight:800;font-size:14px;color:#15803D;margin-bottom:10px;display:flex;align-items:center;gap:6px;border-top:1px solid var(--line);padding-top:16px">
            <span>🏷️</span> إعدادات صفحة تتبع المنتج والطلب المباشر والتصدير (Digital Passport Settings)
          </div>
          <div class="grid grid-2" style="gap:14px;margin-bottom:20px">
            <div>
              <label style="font-size:12.5px;font-weight:700">رقم جوال / واتساب المبيعات والتصدير (مع كود الدولة) *</label>
              <input id="c_trace_whatsapp" value="${escapeHtml(st.settings.traceWhatsapp || activeComp.phone || "201000000001")}" placeholder="مثال: 201012345678" />
              <div class="muted" style="font-size:11px">الرقم الدولي الذي يستقبل رسائل طلبات التصدير والشراء المباشر عند مسح باركود الشحنة.</div>
            </div>
            <div>
              <label style="font-size:12.5px;font-weight:700">قالب رسالة طلب التصدير المباشر عبر الواتساب</label>
              <textarea id="c_trace_msg" rows="2" style="font-size:12px">${escapeHtml(st.settings.traceOrderMsg || "السلام عليكم ورحمة الله، أود الاستفسار عن طلب كميات من التمور لشحنة التتبع: {batch} (الصنف: {variety}) بمزارع {farm}.")}</textarea>
              <div class="muted" style="font-size:11px">المتغيرات المتاحة: {batch} كود الشحنة، {variety} الصنف، {farm} اسم المزرعة.</div>
            </div>
          </div>

          <!-- Section 2: الإعدادات التشغيلية والميدانية للمزرعة -->
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-top:1px solid var(--line);padding-top:16px;flex-wrap:wrap;gap:8px">
            <div style="font-weight:800;font-size:14px;color:#1565c0;display:flex;align-items:center;gap:6px">
              <span>🌾</span> الإعدادات التشغيلية والميدانية للمزرعة
            </div>
          </div>
          <div class="grid grid-2" style="gap:14px;margin-bottom:18px">
            <div>
              <label style="font-size:12.5px;font-weight:700">اسم المزرعة / المشروع الميداني *</label>
              <input id="proj_name_input" value="${escapeHtml(activeProj.name || "")}" placeholder="مثال: مزرعة الفرافرة - قطاع 1" />
            </div>
            <div>
              <label style="font-size:12.5px;font-weight:700">كود بادئة الأصول (Prefix) *</label>
              <input id="proj_prefix_input" value="${escapeHtml(activeProj.codePrefix || activeProj.code_prefix || "BSH1")}" maxlength="6" style="text-transform:uppercase;font-family:monospace" placeholder="مثال: BSH1" />
            </div>

            <div>
              <label style="font-size:12.5px;font-weight:700">المساحة الإجمالية</label>
              <input id="proj_area_input" type="number" value="${activeProj.areaFeddan || activeProj.area_feddan || ""}" placeholder="مثال: 500" />
            </div>
            <div>
              <label style="font-size:12.5px;font-weight:700">الموقع الجغرافي والمنطقة</label>
              <input id="proj_loc_input" value="${escapeHtml(activeProj.locationName || activeProj.location_name || "")}" placeholder="مثال: الوادي الجديد - الفرافرة" />
            </div>

            <div>
              <label style="font-size:12.5px;font-weight:700">المنطقة الزمنية للمزرعة (Timezone)</label>
              <select id="proj_tz_input">
                <option value="Africa/Cairo" ${(activeProj.timezone || st.settings.timezone || "Africa/Cairo")==="Africa/Cairo"?"selected":""}>القاهرة (Africa/Cairo)</option>
                <option value="Asia/Riyadh" ${(activeProj.timezone || st.settings.timezone)==="Asia/Riyadh"?"selected":""}>الرياض (Asia/Riyadh)</option>
                <option value="Asia/Dubai" ${(activeProj.timezone || st.settings.timezone)==="Asia/Dubai"?"selected":""}>دبي (Asia/Dubai)</option>
                <option value="UTC" ${(activeProj.timezone || st.settings.timezone)==="UTC"?"selected":""}>التوقيت العالمي الموحد (UTC)</option>
              </select>
            </div>
            <div>
              <label style="font-size:12.5px;font-weight:700">الإحداثيات الافتراضية للمزرعة (GPS)</label>
              <input id="proj_gps_input" value="${escapeHtml(st.settings.defaultGps || "")}" placeholder="مثال: 28.3582, 28.8687" />
            </div>

            <div>
              <label style="font-size:12.5px;font-weight:700">وحدة قياس المساحة المعتمدة</label>
              <select id="c_land_unit">
                <option value="فدان" ${(st.settings.landUnit||"فدان")==="فدان"?"selected":""}>فدان (4,200 م²)</option>
                <option value="قيراط" ${st.settings.landUnit==="قيراط"?"selected":""}>قيراط (175 م²)</option>
                <option value="هكتار" ${st.settings.landUnit==="هكتار"?"selected":""}>هكتار (10,000 م²)</option>
                <option value="متر مربع" ${st.settings.landUnit==="متر مربع"?"selected":""}>متر مربع (م²)</option>
              </select>
            </div>
            <div>
              <label style="font-size:12.5px;font-weight:700">وحدة قياس الأوزان الافتراضية</label>
              <select id="c_weight_unit">
                <option value="كجم" ${(st.settings.weightUnit||"كجم")==="كجم"?"selected":""}>كيلوجرام (كجم)</option>
                <option value="طن" ${st.settings.weightUnit==="طن"?"selected":""}>طن متري (1,000 كجم)</option>
              </select>
            </div>
          </div>

          <!-- Starter pack banner for easy setup -->
          <div style="background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:14px 16px;margin-bottom:18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
            <div>
              <b style="color:#15803d;font-size:13.5px;display:flex;align-items:center;gap:6px">
                <span>🌱</span> حزمة الإطلاق الافتراضية للمزرعة (Starter Pack)
              </b>
              <div class="muted" style="font-size:12px;margin-top:3px">
                استيراد كتالوج الأسمدة القياسي والقطاعات الافتراضية والمحاصيل بنقرة واحدة لبدء تشغيل هذه المزرعة فوراً.
              </div>
            </div>
            <button class="btn btn-ghost" data-act="clone-starter-pack" data-id="${activeProj.id}" style="border:1.5px solid #16a34a;color:#15803d;font-weight:700;font-size:12.5px;padding:6px 14px;background:#fff">
              📋 استيراد القالب الافتراضي للمزرعة
            </button>
          </div>

          <div style="margin-top:18px;display:flex;justify-content:flex-end">
            <button class="btn btn-primary" data-act="save-all-farm-settings" data-id="${activeComp.id}" style="padding:10px 28px;font-size:14px;font-weight:800;border-radius:10px">
              💾 حفظ بيانات وإعدادات المزرعة
            </button>
          </div>
        </div>

      <!-- Audit Log Shortcut Card -->
      <div class="card" style="margin-top:14px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 18px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <b style="font-size:13.5px;color:var(--green-d);display:flex;align-items:center;gap:6px">
              <span>📜</span> سجل التدقيق والرقابة الشامل (Audit & Security Log)
            </b>
            <div class="muted" style="font-size:12px;margin-top:2px">استعراض وتتبع كافة حركات وأنشطة المستخدمين على مستوى المنظومة مع تصدير الأرشيف المعتمد</div>
          </div>
          <button class="btn btn-ghost icon-btn" data-go="audit" style="border:1.5px solid var(--green);color:var(--green-d);font-weight:bold;font-size:12.5px;padding:6px 14px">فتح سجل التدقيق ◀</button>
        </div>
      </div>

      <!-- Danger Zone Card -->
      ${session()?.role==="admin"?`
        <div class="card" style="margin-top:18px;border:1.5px solid #FCA5A5;background:#FEF2F2;border-radius:12px;padding:16px 20px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px">
            <div>
              <h4 style="margin:0;color:#991B1B;font-size:14.5px;display:flex;align-items:center;gap:6px">
                <span>⚠️</span> منطقة العمليات الحساسة (Danger Zone)
              </h4>
              <div style="font-size:12px;color:#7F1D1D;margin-top:4px;max-width:550px">
                إعادة الضبط تمسح كافة البيانات المحلية المستحدثة وتعيد تحميل العينة التجريبية الافتراضية. هذا الإجراء خاص بإدارة المنظومة فقط ولا يمكن التراجع عنه.
              </div>
            </div>
            <button class="btn btn-orange" data-act="confirm-reset-data" style="white-space:nowrap;font-weight:700;font-size:12.5px;padding:7px 16px">⚠️ إعادة ضبط البيانات التجريبية</button>
          </div>
        </div>
      `:""}
      ${showNewProjectModal ? renderNewProjectModal(st) : ""}
    </div>`;
  }

  // 2. تبويب المحاصيل والزراعات
  if (setTab === "crops") {
    const crops = st.crops || [];
    const editC = editCropId ? crops.find(x => x.id === editCropId) : null;

    return `${settingsTabs()}<div class="card">
      <div class="actions">
        <button class="btn btn-primary icon-btn" data-act="tog-sform" data-id="crop">+ إضافة نوع محصول جديد</button>
      </div>

      ${setForm === "crop" ? `
        <div class="card" style="background:#F7F3EA;border:1.5px solid var(--green);margin-bottom:14px">
          <h4 style="margin-top:0">إضافة نوع محصول جديد للمزرعة</h4>
          <div class="grid grid-2">
            <div><label>اسم المحصول</label><input id="cname_new" placeholder="مثال: أشجار المانجو / الرمان" /></div>
            <div><label>الأيقونة أو الرمز</label>${renderCropIconPicker("cicon_new", "cicon_new_prev", "🌳")}</div>
            <div><label>مسمى الشجرة المفردة</label><input id="csingle_new" placeholder="مثال: شجرة مانجو" /></div>
            <div><label>مسمى الجمع</label><input id="cplural_new" placeholder="مثال: أشجار مانجو" /></div>
            <div>
              <label>نوع ومصدر الإكثار الأساسي (التكاثر)</label>
              <select id="csource_new">
                ${propSources.map(s => `<option value="${s.code}">${s.name} (${s.code}) — ${s.notes || ""}</option>`).join("")}
              </select>
            </div>
            <div>
              <label>استخدام وتصنيف المحصول بالمزرعة</label>
              <select id="cusage_new">
                ${usageTypes.map(u => `<option value="${u.id}">${u.name} — ${u.desc}</option>`).join("")}
              </select>
            </div>
            <div><label>مسمى المحصول والإنتاج</label><input id="cyield_new" placeholder="مثال: ثمار المانجو" /></div>
            <div><label>وحدة قياس الإنتاج</label><input id="cunit_new" value="كجم" style="max-width:120px" /></div>
            <div><label>بادئة التكويد (كود الباركود)</label><input id="cprefix_new" placeholder="مثال: M" maxlength="2" style="max-width:100px" /></div>
          </div>
          <label style="margin-top:8px">مصادر الإكثار المعتمدة لهذا المحصول:</label>
          <div style="display:flex;flex-wrap:wrap;gap:8px;padding:8px;background:#fff;border-radius:8px;border:1px solid var(--line);margin-bottom:8px">
            ${propSources.map(s => `
              <label style="display:inline-flex;align-items:center;gap:4px;margin:0;cursor:pointer;font-size:13px">
                <input type="checkbox" class="c_new_src" value="${s.code}" ${['S','C'].includes(s.code)?'checked':''}>
                <b>${s.code}</b>: ${s.name}
              </label>
            `).join("")}
          </div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn btn-primary" data-act="add-crop">حفظ وتفعيل المحصول</button>
            <button class="btn btn-ghost" data-act="tog-sform" data-id="crop">إلغاء</button>
          </div>
        </div>
      ` : ""}

      ${setForm === "edit-crop" && editC ? `
        <div id="crop_edit_card" class="card" style="background:#F0F7ED;border:2px solid var(--green);margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h4 style="margin:0">تعديل بيانات المحصول: ${cropIcon(editC, 24)} ${editC.name}</h4>
            <button class="btn btn-ghost icon-btn" data-act="cancel-crop-edit">✕ إغلاق</button>
          </div>
          <div class="grid grid-2" style="margin-top:12px">
            <div><label>اسم المحصول</label><input id="cname_edit" value="${editC.name}" /></div>
            <div><label>رمز الأيقونة / الإيموجي</label>${renderCropIconPicker("cicon_edit", "cicon_edit_prev", editC.icon || "🌳")}</div>
            <div><label>مسمى الشجرة المفردة</label><input id="csingle_edit" value="${editC.single || ''}" /></div>
            <div><label>مسمى الجمع</label><input id="cplural_edit" value="${editC.plural || editC.name}" /></div>
            <div>
              <label>نوع ومصدر الإكثار الأساسي (التكاثر)</label>
              <select id="csource_edit">
                ${propSources.map(s => `<option value="${s.code}" ${(editC.primarySourceCode===s.code || editC.offspring===s.name)?'selected':''}>${s.name} (${s.code}) — ${s.notes || ""}</option>`).join("")}
              </select>
            </div>
            <div>
              <label>استخدام وتصنيف المحصول بالمزرعة</label>
              <select id="cusage_edit">
                ${usageTypes.map(u => `<option value="${u.id}" ${(editC.usageType===u.id || editC.notes===u.name)?'selected':''}>${u.name} — ${u.desc}</option>`).join("")}
              </select>
            </div>
            <div><label>مسمى المحصول والإنتاج</label><input id="cyield_edit" value="${editC.yieldName || ''}" /></div>
            <div><label>وحدة قياس الإنتاج</label><input id="cunit_edit" value="${editC.unit || 'كجم'}" style="max-width:120px" /></div>
            <div><label>بادئة التكويد (كود الباركود)</label><input id="cprefix_edit" value="${editC.codePrefix || ''}" maxlength="2" style="max-width:100px" /></div>
          </div>

          <h4 style="margin:14px 0 6px 0">مصادر الإكثار والتكويد الميداني المعتمدة للمحصول (Planting Sources)</h4>
          <p class="muted" style="font-size:12px;margin:0 0 8px 0">حرف المصدر يُستخدم مباشرة في باركود الأشجار (مثل F للفسائل وN للنسيج للنخيل؛ C للعقل وS للشتلات للزيتون).</p>
          <div style="background:#fff;border-radius:8px;padding:8px;border:1px solid var(--line);margin-bottom:10px">
            <table class="dense" style="margin:0">
              <thead><tr><th>حرف الكود</th><th>مسمى المصدر بالعربية</th><th></th></tr></thead>
              <tbody>
                ${(editC.sources || []).map(s => `
                  <tr>
                    <td><b class="chip" style="font-size:13px">${s.code}</b></td>
                    <td>${s.name}</td>
                    <td class="row-acts">
                      ${(editC.sources || []).length > 1 ? `<button class="btn btn-ghost icon-btn" data-act="del-crop-source" data-id="${s.code}" style="color:#C62828">حذف</button>` : `<span class="muted" style="font-size:11px">المصدر الوحيد</span>`}
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
            <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">
              <select id="n_src_picker" style="max-width:240px">
                <option value="">-- أضف من القائمة العامة --</option>
                ${propSources.filter(ps => !(editC.sources || []).some(s => s.code === ps.code)).map(ps => `<option value="${ps.code}" data-name="${ps.name}">${ps.name} (${ps.code})</option>`).join("")}
              </select>
              <button class="btn btn-ghost icon-btn" data-act="add-crop-source-from-picker">+ إضافة من المصادر العامة</button>
              <span class="muted" style="font-size:12px">أو مصدر مخصص:</span>
              <input id="n_src_code" placeholder="حرف (مثال: C)" maxlength="2" style="max-width:90px" />
              <input id="n_src_name" placeholder="اسم المصدر" style="max-width:160px" />
              <button class="btn btn-ghost icon-btn" data-act="add-crop-source">+ إضافة مخصص</button>
            </div>
          </div>

          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn btn-primary" data-act="save-crop-edit">حفظ تعديلات المحصول</button>
            <button class="btn btn-ghost" data-act="cancel-crop-edit">إلغاء</button>
          </div>
        </div>
      ` : ""}

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;margin-bottom:16px">
        ${crops.map(c => {
          const cvars = (st.cropVarieties || []).filter(v => v.cropId === c.id);
          const srcs = (typeof getCropPlantingSources === "function") ? getCropPlantingSources(c.id) : (c.sources || []);
          const usageName = (usageTypes.find(u => u.id === c.usageType)?.name) || c.notes || "محصول بالمزرعة";
          const displayYield = c.yield_name || c.yieldName || (c.id === 'palm' ? 'التمور' : (c.id === 'olive' ? 'الزيتون' : (c.id === 'mango' ? 'ثمار المانجو' : 'المحصول')));
          return `
            <div class="card tile" style="border:1px solid ${c.active ? 'var(--green)' : 'var(--line)'};position:relative">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div style="display:flex;align-items:center;gap:8px">
                  <span>${cropIcon(c, 32)}</span>
                  <div>
                    <h3 style="margin:0">${c.name}</h3>
                    <span class="chip" style="font-size:11px;background:#E8F5E9;color:#1B5E20;margin-top:3px">${usageName}</span>
                  </div>
                </div>
                <span class="status ${c.active ? 'st-sync' : 'st-wait'}">${c.active ? 'نشط بالمزرعة' : 'معطّل'}</span>
              </div>
              <div style="margin:12px 0;padding:8px 10px;background:#F7F3EA;border-radius:8px;font-size:13px;display:grid;grid-template-columns:1fr 1fr;gap:6px">
                <div>المفرد: <b>${c.single}</b></div>
                <div>التكاثر: <b>${c.offspring} (${c.primarySourceCode || '—'})</b></div>
                <div>الإنتاج: <b>${displayYield} (${c.unit || 'كجم'})</b></div>
                <div>كود الباركود: <b>${c.codePrefix}</b></div>
              </div>
              <div style="font-size:12px;margin-bottom:8px">
                <b>مصادر الإكثار:</b> ${srcs.map(s => `<span class="chip" style="margin:2px 3px">${s.code}: ${s.name}${s.isDefault ? ' (افتراضي)' : ''}</span>`).join("") || "—"}
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;border-top:1px solid var(--line);padding-top:8px">
                <button class="btn btn-ghost icon-btn" data-act="edit-crop" data-id="${c.id}">تعديل المحصول ✏️</button>
                <button class="btn btn-ghost icon-btn" data-act="tog-crop" data-id="${c.id}" style="color:${c.active ? '#C62828' : 'var(--green)'}">
                  ${c.active ? 'تعطيل' : 'تنشيط'}
                </button>
              </div>
            </div>
          `;
        }).join("")}
      </div>

      <div class="card" style="background:#fff;border:1px solid var(--line);margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <h4 style="margin:0">🧬 أنواع مصادر الزراعة والإكثار وحروف التكويد (Planting Sources & Coding Letters)</h4>
        </div>
        <p class="muted" style="font-size:12px;margin-top:0">
          تحدد هذه القائمة كافة أنواع مصادر الزراعة المتاحة لجميع المحاصيل (فسائل، نسيج، عقل خضرية، شتلات مطعومة...) والحرف التعريفي المعتمد لكل منها في باركود الأشجار والأصول.
        </p>
        <table class="dense">
          <thead>
            <tr>
              <th>حرف التكويد</th>
              <th>نوع المصدر</th>
              <th>الوصف والاستخدام الميداني</th>
              <th>المحصول النموذجي</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${propSources.map(ps => `
              <tr>
                <td><b class="chip" style="font-size:13px;background:#E8F5E9;color:#1B5E20">${ps.code}</b></td>
                <td><b>${ps.name}</b></td>
                <td class="muted">${ps.notes || "—"}</td>
                <td><span class="chip">${cropName(ps.defaultCropId) || "شامل"}</span></td>
                <td class="row-acts">
                  ${!['F','N','C','S'].includes(ps.code) ? `<button class="btn btn-ghost icon-btn" data-act="del-prop-source-type" data-id="${ps.id}" style="color:#C62828">حذف</button>` : `<span class="muted" style="font-size:11px">مصدر أساسي</span>`}
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        <div style="display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;background:#F7F3EA;padding:8px 12px;border-radius:8px">
          <b style="font-size:12px">+ إضافة نوع مصدر إكثار جديد:</b>
          <input id="new_pst_code" placeholder="حرف الكود (A-Z)" maxlength="2" style="max-width:90px" />
          <input id="new_pst_name" placeholder="اسم المصدر (مثال: ترقيد قمعي)" style="max-width:180px" />
          <input id="new_pst_notes" placeholder="الوصف والاستخدام" style="flex:1;min-width:180px" />
          <select id="new_pst_crop" style="max-width:140px">
            <option value="all">شامل</option>
            ${activeCrops.map(c => `<option value="${c.id}">${cropTextLabel(c)}</option>`).join("")}
          </select>
          <button class="btn btn-primary icon-btn" data-act="add-prop-source-type">إضافة نوع المصدر</button>
        </div>
      </div>

      <div class="card" style="background:#fff;border:1px solid var(--line);margin-bottom:16px">
        <h4 style="margin:0 0 6px 0">🏷️ تصنيفات واستخدامات المحاصيل في المزرعة (Crop Usages)</h4>
        <p class="muted" style="font-size:12px;margin:0 0 8px 0">
          تُحدد طبيعة استثمار وزراعة المحصول في القطع والحقول (رئيسي، بيني، مصدات رياح، تجريبي، مشتل).
        </p>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-bottom:10px">
          ${usageTypes.map(u => `
            <div style="background:#F7F3EA;padding:8px 10px;border-radius:8px;border:1px solid var(--line);font-size:13px">
              <b>${u.name}</b>
              <div class="muted" style="font-size:11px;margin-top:2px">${u.desc}</div>
            </div>
          `).join("")}
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;background:#F7F3EA;padding:8px 12px;border-radius:8px">
          <b style="font-size:12px">+ إضافة تصنيف استخدام:</b>
          <input id="new_cut_name" placeholder="اسم التصنيف (مثال: محصول تغطية)" style="max-width:180px" />
          <input id="new_cut_desc" placeholder="الوصف والهدف" style="flex:1;min-width:200px" />
          <button class="btn btn-ghost icon-btn" data-act="add-crop-usage">إضافة تصنيف</button>
        </div>
      </div>

      <div style="background:#E8F5E9;padding:12px 14px;border-radius:10px;font-size:13px;color:#1B5E20;line-height:1.6">
        🌱 <b>الزراعة البينية في المزارع المصرية (Intercropping):</b><br>
        يتيح النظام إدارة النخيل كأصل رئيسي، مع إمكانية إشراك أشجار الزيتون والمانجو في نفس القطعة الجغرافية (مثل قطعة 12A). كود القطعة ثابت وموحد، ولكل محصول أصنافه وعملياته ومصادر تكويده بديناميكية كاملة.
      </div>
    </div>`;
  }


  // 3. تبويب أصناف المزروعات
  if (setTab === "var") {
    const seenCrops = new Set();
    const cropsList = [];
    (st.crops || []).forEach(c => {
      const code = c.code || c.id;
      if (!seenCrops.has(code)) {
        seenCrops.add(code);
        cropsList.push(c);
      }
    });
    (st.cropVarieties || []).forEach(cv => {
      if (cv.cropId && cv.cropId !== "all" && !seenCrops.has(cv.cropId)) {
        seenCrops.add(cv.cropId);
        cropsList.push({ id: cv.cropId, code: cv.cropId, name: cropName(cv.cropId) || cv.cropId, active: true });
      }
    });
    const allCropVars = st.cropVarieties && st.cropVarieties.length ? st.cropVarieties : st.varieties.map((v, i) => ({ id: "cv" + i, cropId: "palm", name: v, usage: "تمور" }));
    let filteredVars = varCropFilter === "all" ? allCropVars : allCropVars.filter(v => matchesCropFilter(v.cropId, varCropFilter));
    if (varSearchQuery) {
      const vq = varSearchQuery.trim().toLowerCase();
      filteredVars = filteredVars.filter(v => (v.name || "").toLowerCase().includes(vq) || (v.usage || "").toLowerCase().includes(vq));
    }
    const editV = editVarId ? (st.cropVarieties || []).find(x => x.id === editVarId) : null;

    return `${settingsTabs()}<div class="card" style="padding:16px">
      <!-- Toolbar with Pills on Right and Search + Add on Left -->
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--line)">
        <div class="ptabs" style="margin:0;display:flex;gap:4px;overflow-x:auto;padding:2px">
          <button class="${varCropFilter==='all'?'on':''}" data-act="filter-var-crop" data-id="all">كل الأصناف (${allCropVars.length})</button>
          ${cropsList.map(c => {
            const cid = c.code || c.id;
            const cnt = allCropVars.filter(v => matchesCropFilter(v.cropId, cid)).length;
            return `<button class="${matchesCropFilter(varCropFilter, cid)?'on':''}" data-act="filter-var-crop" data-id="${cid}">${cropIcon(c.id, 15)} أصناف ${c.name} (${cnt})</button>`;
          }).join("")}
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:nowrap">
          <input id="var_search" type="search" placeholder="🔍 بحث في الأصناف..." value="${varSearchQuery}" style="font-size:12px;padding:5px 10px;border-radius:6px;border:1px solid var(--line);min-width:160px" />
          <button class="btn btn-primary btn-sm" data-act="tog-sform" data-id="var" style="font-size:12px;padding:5px 12px;white-space:nowrap">+ إضافة صنف جديد</button>
        </div>
      </div>

      ${setForm === "var" ? `
        <div class="card" style="background:#F7F3EA;border:1px solid var(--green);margin-bottom:14px;padding:14px">
          <h4 style="margin-top:0">إضافة صنف جديد</h4>
          <div class="grid grid-3" style="gap:10px">
            <div>
              <label>المحصول التابع له</label>
              <select id="vcrop">
                ${cropsList.map(c => `<option value="${c.code || c.id}" ${matchesCropFilter(varCropFilter, c.code || c.id)?'selected':''}>${cropTextLabel(c)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label>اسم الصنف</label>
              <input id="vname" placeholder="مثال: بيكوال، مجدول، سيوي، مانزانيلا..." />
            </div>
            <div>
              <label>طبيعة الاستخدام / التوصيف</label>
              <input id="vusage" placeholder="مثال: زيت عالي الجودة / مائدة / تصدير فاخر" />
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn btn-primary" data-act="add-crop-var">حفظ الصنف</button>
            <button class="btn btn-ghost" data-act="tog-sform" data-id="var">إلغاء</button>
          </div>
        </div>
      ` : ""}

      ${setForm === "edit-var" && editV ? `
        <div class="card" style="background:#F0F7ED;border:1.5px solid var(--green);margin-bottom:14px;padding:14px">
          <h4 style="margin-top:0">تعديل الصنف: <b>${editV.name}</b></h4>
          <div class="grid grid-3" style="gap:10px">
            <div>
              <label>المحصول التابع له</label>
              <select id="vcrop_edit">
                ${cropsList.map(c => `<option value="${c.code || c.id}" ${matchesCropFilter(editV.cropId, c.code || c.id)?'selected':''}>${cropTextLabel(c)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label>اسم الصنف</label>
              <input id="vname_edit" value="${editV.name}" />
            </div>
            <div>
              <label>طبيعة الاستخدام / التوصيف</label>
              <input id="vusage_edit" value="${editV.usage || ''}" />
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px">
            <button class="btn btn-primary" data-act="save-crop-var" data-id="${editV.id}">حفظ التعديل</button>
            <button class="btn btn-ghost" data-act="cancel-crop-var">إلغاء</button>
          </div>
        </div>
      ` : ""}

      <div class="grid-wrap"><table class="dense" style="--cell-pad: 6px 8px">
        <thead>
          <tr>
            <th style="padding:6px 8px">الصنف</th>
            <th style="padding:6px 8px">المحصول التابع له</th>
            <th style="padding:6px 8px">الاستخدام / المواصفات</th>
            <th style="padding:6px 8px">المسجل في المزرعة</th>
            <th style="padding:6px 8px;text-align:center">الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          ${filteredVars.map(v => {
            const crop = (st.crops||[]).find(c => c.id === v.cropId) || { name: cropName(v.cropId) || "نخيل التمر", icon: v.cropId || "palm" };
            const inTrees = st.palms.filter(p => p.variety === v.name).length;
            return `<tr>
              <td style="padding:6px 8px"><b>${v.name}</b></td>
              <td style="padding:6px 8px">${cropIcon(crop, 16)} ${crop.name}</td>
              <td style="padding:6px 8px" class="muted">${v.usage || "—"}</td>
              <td style="padding:6px 8px">
                ${inTrees > 0 
                  ? `<span class="status st-sync clickable" data-act="go-variety-trees" data-variety="${v.name}" data-crop="${v.cropId||'palm'}" style="cursor:pointer;font-weight:700" title="عرض أشجار هذا الصنف في الحقل">${inTrees} شجرة ↗</span>` 
                  : `<span class="muted">غير مسجل بالحقل</span>`}
              </td>
              <td class="row-acts" style="padding:6px 8px;text-align:center">
                <button class="btn btn-ghost icon-btn" data-act="edit-crop-var" data-id="${v.id}" style="padding:3px 7px;font-size:11.5px">تعديل</button>
                ${inTrees === 0 ? `<button class="btn btn-ghost icon-btn" data-act="del-crop-var" data-id="${v.id}" style="color:#C62828;padding:3px 7px;font-size:11.5px">حذف</button>` : `<span class="muted" style="font-size:11px">مستخدم</span>`}
              </td>
            </tr>`;
          }).join("") || `<tr><td colspan="5" style="text-align:center;padding:16px;color:var(--muted)">لا توجد أصناف مطابقة</td></tr>`}
        </tbody>
      </table></div>
    </div>`;
  }

  // 4. تبويب الزكاة (تم توحيده ونقله بالكامل إلى الشاشة المخصصة "حساب الزكاة" بالقائمة الجانبية)
  if (setTab === "zak") { setTab = "co"; setTimeout(() => go("zakat-admin"), 10); return ""; }

  // 5. تبويب الأسمدة والمركبات
  if (setTab === "fert") {
    let list = st.fertilizers || [];
    if (fertCropFilter !== "all") {
      list = list.filter(f => matchesCropFilter(f.cropId, fertCropFilter));
    }
    const editF = editFertId ? (st.fertilizers || []).find(x => x.id === editFertId) : null;

    return `${settingsTabs()}<div class="card">
      <div class="actions" style="justify-content:space-between;flex-wrap:wrap">
        <div class="ptabs" style="margin:0">
          <button class="${fertCropFilter==='all'?'on':''}" data-act="filter-fert-crop" data-id="all">كل المركبات (${(st.fertilizers||[]).length})</button>
          ${activeCrops.map(c => {
            const cid = c.code || c.id;
            const cnt = (st.fertilizers||[]).filter(f => matchesCropFilter(f.cropId, cid)).length;
            return `<button class="${matchesCropFilter(fertCropFilter, cid)?'on':''}" data-act="filter-fert-crop" data-id="${cid}">${cropIcon(c.id, 16)} ${c.name} (${cnt})</button>`;
          }).join("")}
          <button class="${fertCropFilter==='shared'?'on':''}" data-act="filter-fert-crop" data-id="shared">🌐 المشتركة</button>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <button class="btn btn-ghost icon-btn" data-go="fertilizers">📦 شاشة الأسمدة والمخزون</button>
          <button class="btn btn-primary icon-btn" data-act="tog-sform" data-id="fert">+ إضافة سماد / مركب</button>
        </div>
      </div>

      ${setForm === "fert" ? `
        <div class="card" style="background:#F7F3EA;border:1px solid var(--green);margin-bottom:14px">
          <h4 style="margin-top:0">إضافة مركب / سماد جديد</h4>
          <div class="grid grid-2">
            <div><label>اسم المركب</label><input id="ftname" placeholder="NPK 20-20-20" /></div>
            <div>
              <label>المحصول المستهدف</label>
              <select id="ftcrop">
                <option value="all">🌐 مشترك (كل المحاصيل)</option>
                ${activeCrops.map(c => `<option value="${c.code || c.id}">${cropTextLabel(c)}</option>`).join("")}
              </select>
            </div>
            <div><label>التصنيف</label><select id="ftkind"><option>عضوي</option><option>كيميائي</option><option>عناصر صغرى</option><option>أحماض أمينية</option><option>مبيد</option></select></div>
            <div><label>الوحدة</label><select id="ftunit"><option>جم</option><option>كجم</option><option>لتر</option></select></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn btn-primary" data-act="add-fert">حفظ المركب</button>
            <button class="btn btn-ghost" data-act="tog-sform" data-id="fert">إلغاء</button>
          </div>
        </div>
      ` : ""}

      ${setForm === "edit-fert" && editF ? `
        <div class="card" style="background:#F0F7ED;border:1.5px solid var(--green);margin-bottom:14px">
          <h4 style="margin-top:0">تعديل المركب: <b>${editF.name}</b></h4>
          <div class="grid grid-2">
            <div><label>اسم المركب</label><input id="ftname_edit" value="${editF.name}" /></div>
            <div>
              <label>المحصول المستهدف</label>
              <select id="ftcrop_edit">
                <option value="all" ${editF.cropId==='all'||!editF.cropId?'selected':''}>🌐 مشترك (كل المحاصيل)</option>
                ${activeCrops.map(c => `<option value="${c.code || c.id}" ${matchesCropFilter(editF.cropId, c.code || c.id)?'selected':''}>${cropTextLabel(c)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label>التصنيف</label>
              <select id="ftkind_edit">
                ${["عضوي","كيميائي","عناصر صغرى","أحماض أمينية","مبيد"].map(k => `<option ${editF.kind===k?'selected':''}>${k}</option>`).join("")}
              </select>
            </div>
            <div>
              <label>الوحدة</label>
              <select id="ftunit_edit">
                ${["جم","كجم","لتر"].map(u => `<option ${editF.unit===u?'selected':''}>${u}</option>`).join("")}
              </select>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn btn-primary" data-act="save-fert-edit">حفظ التعديل</button>
            <button class="btn btn-ghost" data-act="cancel-fert-edit">إلغاء</button>
          </div>
        </div>
      ` : ""}

      <table class="dense">
        <thead><tr><th>الاسم</th><th>المحصول المستهدف</th><th>النوع</th><th>الوحدة</th><th>رصيد المستودع</th><th>الحالة</th><th></th></tr></thead>
        <tbody>${list.map(f => {
          const cropBadge = f.cropId === "olive" ? `${cropIcon("olive", 16)} زيتون` : (f.cropId === "palm" ? "🌴 نخيل" : "🌐 مشترك");
          return `<tr>
            <td><b>${f.name}</b></td>
            <td><span class="muted">${cropBadge}</span></td>
            <td>${f.kind}</td>
            <td>${f.unit}</td>
            <td><b>${(Number(f.stock)||0).toLocaleString()} ${f.unit}</b></td>
            <td>${f.active ? '<span class="status st-sync">نشط</span>' : '<span class="status st-wait">معطّل</span>'}</td>
            <td class="row-acts">
              <button class="btn btn-ghost icon-btn" data-act="edit-fert" data-id="${f.id}">تعديل</button>
              <button class="btn btn-ghost icon-btn" data-act="tog-fert" data-id="${f.id}">${f.active?"تعطيل":"تنشيط"}</button>
            </td>
          </tr>`;
        }).join("")}</tbody>
      </table>
    </div>`;
  }

  // 6. تبويب المشتل والتكاثر
  if (setTab === "nur") {
    let preps = st.nurseryPrepTypes || [];
    if (nurCropFilter !== "all") {
      preps = preps.filter(p => matchesCropFilter(p.cropId, nurCropFilter));
    }
    const editP = editPrepId ? (st.nurseryPrepTypes || []).find(x => x.id === editPrepId) : null;

    return `${settingsTabs()}<div class="card">
      <div class="actions" style="justify-content:space-between;flex-wrap:wrap">
        <div class="ptabs" style="margin:0">
          <button class="${nurCropFilter==='all'?'on':''}" data-act="filter-nur-crop" data-id="all">كل الأنشطة (${(st.nurseryPrepTypes||[]).length})</button>
          ${activeCrops.map(c => {
            const cid = c.code || c.id;
            const cnt = (st.nurseryPrepTypes||[]).filter(p => matchesCropFilter(p.cropId, cid)).length;
            return `<button class="${matchesCropFilter(nurCropFilter, cid)?'on':''}" data-act="filter-nur-crop" data-id="${cid}">${cropIcon(c.id, 16)} ${c.name} (${cnt})</button>`;
          }).join("")}
          <button class="${nurCropFilter==='shared'?'on':''}" data-act="filter-nur-crop" data-id="shared">🌐 المشتركة (${(st.nurseryPrepTypes||[]).filter(p => !p.cropId || p.cropId === 'all' || p.cropId === 'shared').length})</button>
        </div>
        <button class="btn btn-primary icon-btn" data-act="tog-sform" data-id="nur">+ إضافة نشاط</button>
      </div>

      ${setForm === "nur" ? `
        <div class="card" style="background:#F7F3EA;border:1px solid var(--green);margin-bottom:14px">
          <h4 style="margin-top:0">إضافة نشاط تجهيز مشتل جديد</h4>
          <div class="grid grid-3">
            <div><label>اسم النشاط</label><input id="prepname" placeholder="مثال: تجذير عقل / فرز فسائل..." /></div>
            <div>
              <label>المحصول التابع له</label>
              <select id="prepcrop" onchange="window._onPrepCropChange(this, 'prepsrc')">
                <option value="all">🌐 مشترك لكل المحاصيل</option>
                ${activeCrops.map(c => `<option value="${c.code || c.id}">${cropTextLabel(c)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label>نوع الأصل / مصدر الإكثار المستهدف</label>
              <select id="prepsrc">
                <option value="all">🌐 كل المصادر (شامل)</option>
                ${getCropPlantingSourcesForSelect("all").map(s => `<option value="${s.code}">${s.name} (${s.code})</option>`).join("")}
              </select>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn btn-primary" data-act="add-prep">حفظ النشاط</button>
            <button class="btn btn-ghost" data-act="tog-sform" data-id="nur">إلغاء</button>
          </div>
        </div>
      ` : ""}

      ${setForm === "edit-prep" && editP ? `
        <div class="card" style="background:#F0F7ED;border:1.5px solid var(--green);margin-bottom:14px">
          <h4 style="margin-top:0">تعديل نشاط المشتل: <b>${editP.name}</b></h4>
          <div class="grid grid-3">
            <div><label>اسم النشاط</label><input id="prepname_edit" value="${editP.name}" /></div>
            <div>
              <label>المحصول التابع له</label>
              <select id="prepcrop_edit" onchange="window._onPrepCropChange(this, 'prepsrc_edit')">
                <option value="all" ${editP.cropId==='all'||!editP.cropId?'selected':''}>🌐 مشترك لكل المحاصيل</option>
                ${activeCrops.map(c => `<option value="${c.code || c.id}" ${matchesCropFilter(editP.cropId, c.code || c.id)?'selected':''}>${cropTextLabel(c)}</option>`).join("")}
              </select>
            </div>
            <div>
              <label>نوع الأصل / مصدر الإكثار المستهدف</label>
              <select id="prepsrc_edit">
                <option value="all" ${(!editP.sourceCode || editP.sourceCode==='all')?'selected':''}>🌐 كل المصادر (شامل)</option>
                ${getCropPlantingSourcesForSelect(editP.cropId).map(s => `<option value="${s.code}" ${editP.sourceCode===s.code?'selected':''}>${s.name} (${s.code})</option>`).join("")}
              </select>
            </div>
          </div>
          <div style="display:flex;gap:8px;margin-top:8px">
            <button class="btn btn-primary" data-act="save-prep-edit" data-id="${editP.id}">حفظ التعديل</button>
            <button class="btn btn-ghost" data-act="cancel-prep-edit">إلغاء</button>
          </div>
        </div>
      ` : ""}

      <table class="dense">
        <thead><tr><th>نشاط التجهيز</th><th>المحصول التابع له</th><th>نوع الأصل / المصدر</th><th>الحالة</th><th></th></tr></thead>
        <tbody>${preps.map(t => {
          const crp = (st.crops || []).find(c => (c.code || c.id) === t.cropId);
          const cropBadge = crp ? `${cropIcon(crp.id, 16)} ${crp.name}` : (t.cropId === "all" || !t.cropId ? "🌐 مشترك" : t.cropId);
          const allSrcs = (st.cropPlantingSources || []).concat(st.propagationSourceTypes || []);
          const srcObj = allSrcs.find(s => (s.codeLetter || s.code) === t.sourceCode);
          const srcBadge = t.sourceCode && t.sourceCode !== "all" ? `<span class="chip" style="font-size:11px;background:#E8F5E9;color:#1B5E20"><b>${t.sourceCode}</b>: ${srcObj ? srcObj.name : t.sourceCode}</span>` : `<span class="chip" style="font-size:11px">شامل كل المصادر</span>`;
          const isActive = t.active !== false;
          return `<tr>
            <td><b>${t.name}</b></td>
            <td><span class="muted">${cropBadge}</span></td>
            <td>${srcBadge}</td>
            <td><span class="status ${isActive ? 'st-sync' : 'st-wait'}">${isActive ? 'نشط' : 'معطّل'}</span></td>
            <td class="row-acts">
              <button class="btn btn-ghost icon-btn" data-act="edit-prep" data-id="${t.id}">تعديل ✏️</button>
              <button class="btn btn-ghost icon-btn" data-act="tog-prep" data-id="${t.id}" style="color:${isActive ? '#C62828' : 'var(--green)'}">
                ${isActive ? 'تعطيل' : 'تنشيط'}
              </button>
            </td>
          </tr>`;
        }).join("")}</tbody>
      </table>
    </div>`;
  }

  // 7. تبويب تصنيفات العمليات
  let opTypes = st.operationTypes || [];
  if (opsCropFilter !== "all") {
    opTypes = opTypes.filter(t => matchesCropFilter(t.cropId, opsCropFilter));
  }
  if (opsTypeSearch) {
    const oq = opsTypeSearch.trim().toLowerCase();
    opTypes = opTypes.filter(t => (t.name || "").toLowerCase().includes(oq) || (catName(t.catId) || "").toLowerCase().includes(oq));
  }
  const editO = editOpId ? (st.operationTypes || []).find(x => x.id === editOpId) : null;

  return `${settingsTabs()}
    <div class="card" style="margin-bottom:14px;background:#F8FAFC;border:1px solid #CBD5E1;border-radius:10px;padding:14px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
        <div>
          <b style="font-size:14px;color:var(--text);display:flex;align-items:center;gap:6px">
            <span>⚡</span> مفتاح تسجيل العمليات السريعة للأشجار (Quick Operations Button)
          </b>
          <div class="muted" style="font-size:12px;margin-top:3px">
            التحكم في تفعيل أو تعطيل أو إخفاء زر «⚡ عملية سريعة» في بطاقة الشجرة وتفاصيل الأصول لحسابات العمال والمشرفين.
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;background:#FFFFFF;border:1px solid #CBD5E1;border-radius:8px;padding:6px 14px">
            <input type="checkbox" id="toggle_quick_op" data-act="toggle-quick-op-setting" ${!st.settings?.hideQuickOp ? 'checked' : ''} style="width:16px;height:16px;accent-color:#16A34A" />
            <span style="font-weight:700;font-size:12.5px;color:${!st.settings?.hideQuickOp ? '#16A34A' : '#64748B'}">
              ${!st.settings?.hideQuickOp ? '✓ مفعّل ومُتاح' : '✕ معطّل ومخفي'}
            </span>
          </label>
        </div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:minmax(240px, 280px) minmax(0, 1fr);gap:14px;align-items:start;width:100%;max-width:100%;box-sizing:border-box">
      <!-- Right Column: Categories List (30%) -->
      <div class="card" style="padding:14px;margin:0;background:#fff;border:1px solid var(--line);border-radius:10px;min-width:0;box-sizing:border-box">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--line)">
          <h4 style="margin:0;font-size:14.5px;color:var(--text);font-weight:800">🏷️ التصنيفات (${(st.operationCats||[]).length})</h4>
          <button class="btn btn-ghost btn-sm" data-act="tog-sform" data-id="cat" style="font-size:12px;padding:3px 8px;border:1px solid var(--green);color:var(--green-d);font-weight:700">+ تصنيف</button>
        </div>

        ${setForm==="cat"?`
          <div style="background:#F7F3EA;border:1px solid var(--green);border-radius:8px;padding:10px;margin-bottom:10px">
            <label style="font-size:11.5px;font-weight:700">اسم التصنيف الجديد:</label>
            <input id="catnew" placeholder="مثال: وقاية ومكافحة" style="margin-bottom:8px;font-size:12.5px" />
            <div style="display:flex;gap:6px">
              <button class="btn btn-primary btn-sm" data-act="add-cat" style="font-size:11.5px;padding:4px 10px">حفظ</button>
              <button class="btn btn-ghost btn-sm" data-act="tog-sform" data-id="cat" style="font-size:11.5px;padding:4px 8px">إلغاء</button>
            </div>
          </div>
        `:""}

        <div style="display:flex;flex-direction:column;gap:6px">
          ${(st.operationCats||[]).map(c => {
            const opsCount = st.operationTypes.filter(t => t.catId === c.id).length;
            const isUsed = usedCat(c.id);
            return `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:8px;font-size:12.5px">
                <div>
                  <b style="color:var(--text)">${c.name}</b>
                  <div class="muted" style="font-size:10.5px">${opsCount} عملية مرتبطة</div>
                </div>
                <div style="display:flex;gap:4px">
                  <button class="btn btn-ghost icon-btn" data-act="ren-cat" data-id="${c.id}" style="padding:2px 6px;font-size:11px" title="تعديل">✏️</button>
                  <button class="btn btn-ghost icon-btn" data-act="del-cat" data-id="${c.id}" style="color:${isUsed?'#94A3B8':'#DC2626'};padding:2px 6px;font-size:11px" title="${isUsed?'مستخدم بسجلات':'حذف'}">🗑️</button>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      </div>

      <!-- Left Column: Operations Table (70%) -->
      <div class="card" style="padding:14px;margin:0;background:#fff;border:1px solid var(--line);border-radius:10px;min-width:0;max-width:100%;box-sizing:border-box;overflow:hidden">
        <!-- Crop Pills & Filter & Add Op -->
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--line)">
          <div class="ptabs" style="margin:0;display:flex;gap:4px;overflow-x:auto;max-width:100%;flex-wrap:wrap">
            <button class="${opsCropFilter==='all'?'on':''}" data-act="filter-ops-crop" data-id="all">كل العمليات (${(st.operationTypes||[]).length})</button>
            ${activeCrops.map(c => {
              const cid = c.code || c.id;
              const cnt = (st.operationTypes||[]).filter(t => matchesCropFilter(t.cropId, cid)).length;
              return `<button class="${matchesCropFilter(opsCropFilter, cid)?'on':''}" data-act="filter-ops-crop" data-id="${cid}">${cropIcon(c.id, 15)} ${c.name} (${cnt})</button>`;
            }).join("")}
            <button class="${opsCropFilter==='shared'?'on':''}" data-act="filter-ops-crop" data-id="shared">🌐 المشتركة</button>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:nowrap">
            <input id="optype_search" type="search" placeholder="🔍 بحث في العمليات..." value="${opsTypeSearch}" style="font-size:12px;padding:5px 10px;border-radius:6px;border:1px solid var(--line);min-width:150px" />
            <button class="btn btn-primary btn-sm" data-act="tog-sform" data-id="op" style="font-size:12px;padding:5px 12px;white-space:nowrap">+ إضافة عملية</button>
          </div>
        </div>

        ${setForm==="op"?`
          <div class="card" style="background:#F7F3EA;border:1px solid var(--green);margin-bottom:14px;padding:12px">
            <h4 style="margin-top:0">إضافة عملية زراعية جديدة</h4>
            <div class="grid grid-2" style="gap:10px">
              <div><label>التصنيف الرئيسي</label><select id="nop_cat">${(st.operationCats||[]).map(c=>`<option value="${c.id}">${c.name}</option>`)}</select></div>
              <div>
                <label>المحصول المستهدف</label>
                <select id="nop_crop">
                  <option value="all">🌐 مشترك لكل الحقل</option>
                  ${activeCrops.map(c => `<option value="${c.code || c.id}">${cropTextLabel(c)}</option>`).join("")}
                </select>
              </div>
            </div>
            <label>اسم العملية</label><input id="nop_name" placeholder="مثال: تلقيح، تقليم، مكافحة..." />
            
            <div class="grid grid-2" style="gap:10px;margin-top:6px">
              <div>
                <label>نطاق التنفيذ المسموح به</label>
                <select id="nop_scope">
                  <option value="both" selected>🌐 شامل (فردي وجماعي)</option>
                  <option value="individual">🌴 فردي فقط (نخلة محددة - كالسوسة والقلع)</option>
                  <option value="bulk">📦 جماعي فقط (حزم وقطاعات - كالتسميد والخدمة)</option>
                </select>
              </div>
              <div style="display:flex;align-items:center;margin-top:24px">
                <label style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-weight:700">
                  <input type="checkbox" id="nop_critical" style="width:16px;height:16px;accent-color:#DC2626">
                  <span style="color:#DC2626;font-size:12.5px">🚨 عملية حرجة (تتطلب اعتماد المشرف)</span>
                </label>
              </div>
            </div>

            <label style="margin-top:8px">تتطلب مركباً أو مادة؟</label>
            <select id="nop_need"><option value="0" selected>لا — خدمة ميكانيكية</option><option value="1">نعم — سماد أو مبيد</option></select>
            <div id="nop_kind_wrap" style="display:none;margin-top:6px">
              <label>أنواع المواد المسموحة</label>
              <select id="nop_kind"><option value="عضوي">أسمدة عضوية</option><option value="كيميائي">أسمدة كيميائية</option><option value="مبيد">مبيدات</option><option value="عضوي,كيميائي">كل الأسمدة</option><option value="عضوي,كيميائي,مبيد">الكل</option></select>
            </div>
            <div style="display:flex;gap:8px;margin-top:8px">
              <button class="btn btn-primary" data-act="add-optype">حفظ العملية</button>
              <button class="btn btn-ghost" data-act="tog-sform" data-id="op">إلغاء</button>
            </div>
          </div>` : ""}

        ${setForm === "edit-op" && editO ? `
          <div class="card" style="background:#F0F7ED;border:1.5px solid var(--green);margin-bottom:14px;padding:12px">
            <h4 style="margin-top:0">تعديل العملية: <b>${editO.name}</b></h4>
            <div class="grid grid-2" style="gap:10px">
              <div><label>التصنيف الرئيسي</label><select id="ecat">${(st.operationCats||[]).map(c=>`<option value="${c.id}">${c.name}</option>`)}</select></div>
              <div>
                <label>المحصول المستهدف</label>
                <select id="ecrop">
                  <option value="all" ${editO.cropId==='all'||!editO.cropId?'selected':''}>🌐 مشترك لكل الحقل</option>
                  ${activeCrops.map(c => `<option value="${c.code || c.id}" ${matchesCropFilter(editO.cropId, c.code || c.id)?'selected':''}>${cropTextLabel(c)}</option>`).join("")}
                </select>
              </div>
            </div>
            <label>اسم العملية</label><input id="ename" value="${editO.name}" />

            <div class="grid grid-2" style="gap:10px;margin-top:6px">
              <div>
                <label>نطاق التنفيذ المسموح به</label>
                <select id="escope">
                  <option value="both" ${(!editO.scopeType || editO.scopeType==='both')?'selected':''}>🌐 شامل (فردي وجماعي)</option>
                  <option value="individual" ${editO.scopeType==='individual'?'selected':''}>🌴 فردي فقط (نخلة محددة - كالسوسة والقلع)</option>
                  <option value="bulk" ${editO.scopeType==='bulk'?'selected':''}>📦 جماعي فقط (حزم وقطاعات - كالتسميد والخدمة)</option>
                </select>
              </div>
              <div style="display:flex;align-items:center;margin-top:24px">
                <label style="cursor:pointer;display:inline-flex;align-items:center;gap:6px;font-weight:700">
                  <input type="checkbox" id="ecritical" ${editO.isCritical?'checked':''} style="width:16px;height:16px;accent-color:#DC2626">
                  <span style="color:#DC2626;font-size:12.5px">🚨 عملية حرجة (تتطلب اعتماد المشرف)</span>
                </label>
              </div>
            </div>

            <label style="margin-top:8px">تتطلب مركباً؟</label>
            <select id="eneed">
              <option value="0" ${!editO.requiresMaterial?'selected':''}>لا — خدمة ميكانيكية</option>
              <option value="1" ${editO.requiresMaterial?'selected':''}>نعم — سماد أو مبيد</option>
            </select>
            <div id="ekind_wrap" style="display:${editO.requiresMaterial?'block':'none'};margin-top:6px">
              <label>أنواع المواد المسموحة</label>
              <select id="ekind">
                <option value="عضوي" ${(editO.allowedKinds||[]).join(",")==='عضوي'?'selected':''}>أسمدة عضوية</option>
                <option value="كيميائي" ${(editO.allowedKinds||[]).join(",")==='كيميائي'?'selected':''}>أسمدة كيميائية</option>
                <option value="مبيد" ${(editO.allowedKinds||[]).join(",")==='مبيد'?'selected':''}>مبيدات</option>
                <option value="عضوي,كيميائي" ${(editO.allowedKinds||[]).join(",")==='عضوي,كيميائي'?'selected':''}>كل الأسمدة</option>
                <option value="عضوي,كيميائي,مبيد" ${(editO.allowedKinds||[]).join(",")==='عضوي,كيميائي,مبيد'?'selected':''}>الكل</option>
              </select>
            </div>
            <div style="display:flex;gap:8px;margin-top:8px">
              <button class="btn btn-primary" data-act="save-optype-edit" data-id="${editO.id}">حفظ التعديلات</button>
              <button class="btn btn-ghost" data-act="cancel-optype-edit">إلغاء</button>
            </div>
          </div>
        ` : ""}

        <div class="grid-wrap" style="overflow-x:auto;max-width:100%;width:100%;border-radius:6px"><table class="dense" style="--cell-pad: 6px 8px;width:100%;min-width:620px">
          <thead>
            <tr>
              <th style="padding:6px 8px">العملية</th>
              <th style="padding:6px 8px">المحصول</th>
              <th style="padding:6px 8px">التصنيف</th>
              <th style="padding:6px 8px">نطاق التنفيذ</th>
              <th style="padding:6px 8px">نوع المستلزم / المادة</th>
              <th style="padding:6px 8px;text-align:center">الحالة</th>
              <th style="padding:6px 8px;text-align:center">السجلات</th>
              <th style="padding:6px 8px;text-align:center">الإجراءات</th>
            </tr>
          </thead>
          <tbody>${opTypes.map(t => {
            const n = st.operations.filter(o=>o.typeId===t.id).length;
            const rule = opMaterialRule(t.id);
            const cropLab = t.cropId === "olive" ? `${cropIcon("olive", 15)} زيتون` : (t.cropId === "palm" ? "🌴 نخيل" : "🌐 مشترك");
            
            let matBadges = `<span class="muted">—</span>`;
            if (rule.show || t.requiresMaterial) {
              const kinds = t.allowedKinds && t.allowedKinds.length ? t.allowedKinds : rule.kinds;
              matBadges = kinds.map(k => {
                if (k === "عضوي") return `<span class="badge" style="background:#DCFCE7;color:#166534;font-size:10.5px">🌿 عضوي</span>`;
                if (k === "كيميائي") return `<span class="badge" style="background:#DBEAFE;color:#1E40AF;font-size:10.5px">🧪 كيميائي</span>`;
                if (k === "مبيد") return `<span class="badge" style="background:#FEE2E2;color:#991B1B;font-size:10.5px">⚠️ مبيد</span>`;
                return `<span class="badge" style="font-size:10.5px">${k}</span>`;
              }).join(" ");
            }

            const scopeBadge = t.scopeType === 'individual' ? '<span class="badge" style="background:#EFF6FF;color:#1D4ED8;font-size:10px">🌴 فردي فقط</span>' :
                               t.scopeType === 'bulk' ? '<span class="badge" style="background:#F0FDF4;color:#166534;font-size:10px">📦 جماعي فقط</span>' :
                               '<span class="badge" style="background:#F1F5F9;color:#475569;font-size:10px">🌐 شامل</span>';
            const critBadge = t.isCritical ? '<span class="badge" style="background:#FEE2E2;color:#991B1B;font-size:10px;margin-right:2px">🚨 حرجة</span>' : '';

            return `<tr>
              <td style="padding:6px 8px">
                <b>${t.name}</b>
              </td>
              <td style="padding:6px 8px"><span class="muted">${cropLab}</span></td>
              <td style="padding:6px 8px">${catName(t.catId)}</td>
              <td style="padding:6px 8px;white-space:nowrap">${scopeBadge} ${critBadge}</td>
              <td style="padding:6px 8px">${matBadges}</td>
              <td style="padding:6px 8px;text-align:center">
                <label style="cursor:pointer;display:inline-flex;align-items:center;gap:5px" title="${t.inactive?'معطلة - اضغط للتنشيط':'نشطة - اضغط للتعطيل'}">
                  <input type="checkbox" ${!t.inactive ? 'checked' : ''} data-act="tog-optype-status" data-id="${t.id}" style="cursor:pointer;accent-color:#16A34A;width:15px;height:15px">
                  <span style="font-size:11px;font-weight:700;color:${!t.inactive ? '#16A34A' : '#94A3B8'}">${!t.inactive ? 'نشطة' : 'معطلة'}</span>
                </label>
              </td>
              <td style="padding:6px 8px;text-align:center"><span class="chip" style="font-size:11px">${n}</span></td>
              <td class="row-acts" style="padding:6px 8px;text-align:center">
                <button class="btn btn-ghost icon-btn" data-act="edit-optype" data-id="${t.id}" style="padding:3px 7px;font-size:11.5px">تعديل</button>
                ${n === 0 ? `<button class="btn btn-ghost icon-btn" data-act="del-optype" data-id="${t.id}" style="color:#DC2626;padding:3px 7px;font-size:11.5px">حذف</button>` : ''}
              </td>
            </tr>`;
          }).join("") || `<tr><td colspan="8" style="text-align:center;padding:16px;color:var(--muted)">لا توجد عمليات مطابقة</td></tr>`}
          </tbody>
        </table></div>
      </div>
    </div>

    ${(() => {
      const editCat = editCatId ? (st.operationCats || []).find(c => c.id === editCatId) : null;
      if (!editCat) return "";
      return `
        <div class="modal-backdrop">
          <div class="modal-box">
            <div class="modal-head">
              <h3>تعديل تصنيف العمليات</h3>
              <button class="btn btn-ghost icon-btn" data-act="cancel-cat-edit">✕</button>
            </div>
            <div>
              <label>اسم التصنيف</label>
              <input id="cat_edit_name" value="${editCat.name}" placeholder="اسم التصنيف" style="margin-bottom:12px" />
              <p class="muted" style="font-size:12px;margin:0">سيتم تطبيق التعديل فوراً على كافة العمليات المرتبطة بهذا التصنيف.</p>
            </div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:18px">
              <button class="btn btn-ghost" data-act="cancel-cat-edit">إلغاء</button>
              <button class="btn btn-primary" data-act="save-cat-edit" data-id="${editCat.id}">حفظ التعديل</button>
            </div>
          </div>
        </div>
      `;
    })()}`;
}

function i18nStudioView() {
  const isAr = I18n.getLang() === "ar";
  const st = Store.get();
  const isLangToggleEnabled = !!st.settings?.showLangToggle;
  const stats = I18n.getStats(i18nEditLang);
  const categories = I18n.getCategories();
  const items = I18n.getStudioItems(i18nEditLang, i18nCat, i18nQuery);
  const langs = I18n.getLanguages();

  return `
    <div class="card" style="margin-bottom:16px;border-top:4px solid ${isLangToggleEnabled ? 'var(--green)' : '#dc2626'};background:${isLangToggleEnabled ? '#f0fdf4' : '#fff7ed'}">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:14px">
        <div style="flex:1;min-width:280px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;flex-wrap:wrap">
            <span style="font-size:22px">${isLangToggleEnabled ? '🌐' : '🔒'}</span>
            <h3 style="margin:0;font-size:16px;color:var(--text)">
              ${t("i18n_toggle_card_title", "ظهور مفتاح تحويل اللغات للمستخدمين في الواجهة (Language Switcher)")}
            </h3>
            <span class="badge" style="background:${isLangToggleEnabled ? '#dcfce7' : '#fee2e2'};color:${isLangToggleEnabled ? '#15803d' : '#b91c1c'};font-weight:bold;font-size:12px;padding:3px 10px;border-radius:12px;border:1px solid ${isLangToggleEnabled ? '#86efac' : '#fca5a5'}">
              ${isLangToggleEnabled ? `✅ ${t("i18n_toggle_status_enabled", "مفعّل — مفتاح تبديل اللغات ظاهر للمستخدمين")}` : `🔒 ${t("i18n_toggle_status_disabled", "معطّل — مفتاح تبديل اللغات مخفي (واجهة عربية معتمدة فقط)")}`}
            </span>
          </div>
          <p style="margin:0;font-size:13px;color:#475569;line-height:1.5">
            ${t("i18n_toggle_card_desc", "التحكم في إظهار أو إخفاء زر التبديل بين اللغات (العربية / English) في الشريط العلوي وشاشة تسجيل الدخول لكافة المستخدمين")}
          </p>
          <div style="margin-top:6px;font-size:12px;color:#64748b">
            💡 ${t("i18n_toggle_hint", "ملاحظة: نظراً لعدم اكتمال الترجمة في بعض الشاشات، يمكنك إخفاء المفتاح لمنع ظهور شاشات متباينة، وسيتم تحويل النظام فورياً إلى العربية المعتمدة.")}
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:10px">
          <button class="btn ${isLangToggleEnabled ? 'btn-ghost' : 'btn-primary'}" data-act="toggle-lang-switcher" style="padding:9px 18px;font-weight:bold;display:inline-flex;align-items:center;gap:8px;font-size:13px;${isLangToggleEnabled ? 'border:1px solid #dc2626;color:#b91c1c;background:#fff' : 'background:#15803d;color:#fff'}">
            ${isLangToggleEnabled ? `
              <span>🔒</span>
              <span>${t("i18n_toggle_btn_disable", "تعطيل وإخفاء مفتاح تبديل اللغات (إلزام الواجهة العربية)")}</span>
            ` : `
              <span>🌐</span>
              <span>${t("i18n_toggle_btn_enable", "تفعيل وإظهار مفتاح تبديل اللغات")}</span>
            `}
          </button>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px;border-top:4px solid var(--green)">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px">
        <div>
          <h3 style="margin:0 0 4px 0;display:flex;align-items:center;gap:8px">
            🌐 ${t("i18n_studio_title", "محرر القواميس والترجمات التفاعلي")}
          </h3>
          <p class="muted" style="margin:0;font-size:13px">
            ${t("i18n_studio_desc", "تخصيص وترجمة كافة مصطلحات وشاشات المنظومة بسهولة تامة وبدون تعديل الكود المصدري")}
          </p>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <label style="font-weight:bold;margin:0;font-size:13px">${t("i18n_active_lang", "اللغة الحالية للتعديل")}:</label>
          <select id="i18n_lang_select" data-act="i18n-change-lang" style="padding:6px 12px;border-radius:6px;font-weight:bold">
            ${langs.map(l => `<option value="${l.code}" ${i18nEditLang===l.code?'selected':''}>${l.flag || ''} ${l.name} (${l.nativeName || l.name})</option>`).join("")}
          </select>
        </div>
      </div>

      <div style="margin-top:14px;background:#f8fafc;padding:12px;border-radius:8px;border:1px solid var(--line)">
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:bold;margin-bottom:6px">
          <span>${t("i18n_progress", "نسبة اكتمال الترجمة: {pct}% ({done} من {total} مصطلح)", { pct: stats.pct, done: stats.done, total: stats.total })}</span>
          <span>${stats.custom ? `<span class="badge" style="background:#e0f2fe;color:#0369a1">${stats.custom} مصطلح مخصص</span>` : ''}</span>
        </div>
        <div class="i18n-progress-bar">
          <div class="i18n-progress-fill" style="width:${stats.pct}%"></div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:16px">
        <div class="ptabs" style="margin:0;display:flex;flex-wrap:wrap;gap:4px">
          ${categories.map(c => `
            <button class="${i18nCat===c.id?'on':''}" data-act="i18n-cat-change" data-id="${c.id}" style="padding:4px 10px;font-size:12px">
              ${c.name}
            </button>
          `).join("")}
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex:1;max-width:320px;min-width:200px">
          <input id="i18n_search" value="${i18nQuery||''}" placeholder="${t("i18n_search_placeholder", "ابحث في المصطلحات أو الأكواد...")}" style="padding:6px 10px;font-size:13px;width:100%" />
          <button class="btn btn-ghost" data-act="i18n-search-btn" style="padding:6px 10px">🔍</button>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
        <button class="btn btn-primary" data-act="i18n-save">💾 ${t("btn_save", "حفظ التعديلات")}</button>
        <button class="btn btn-ghost" data-act="i18n-export">📊 ${t("i18n_export_btn", "تصدير القاموس إلى Excel (CSV)")}</button>
        <button class="btn btn-ghost" data-act="i18n-open-import">📥 ${t("i18n_import_btn", "استيراد ملف ترجمة (CSV)")}</button>
        <button class="btn btn-ghost" data-act="i18n-reset" style="color:#b91c1c">🔄 ${t("i18n_reset_btn", "استعادة القاموس الافتراضي")}</button>
      </div>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div class="grid-wrap">
        <table class="dense" style="margin:0;width:100%">
          <thead>
            <tr style="background:#f1f5f9">
              <th style="width:22%">${t("i18n_col_key", "كود المصطلح")}</th>
              <th style="width:28%">${t("i18n_col_original", "الأصل العربي")}</th>
              <th style="width:38%">${t("i18n_col_translation", "الترجمة في اللغة المختارة")}</th>
              <th style="width:12%;text-align:center">${t("i18n_col_status", "حالة الترجمة")}</th>
            </tr>
          </thead>
          <tbody id="i18n_tbody">
            ${items.length === 0 ? `
              <tr><td colspan="4" style="text-align:center;padding:24px;color:var(--muted)">لا توجد مصطلحات مطابقة للبحث أو التصنيف الحالي</td></tr>
            ` : items.map(item => `
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
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>

    ${i18nShowImportModal ? `
      <div class="modal-backdrop">
        <div class="modal-box" style="max-width:550px">
          <div class="modal-head">
            <h3>📥 ${t("i18n_import_btn", "استيراد ملف ترجمة (CSV)")}</h3>
            <button class="btn btn-ghost icon-btn" data-act="i18n-close-import">✕</button>
          </div>
          <div style="padding:12px 0">
            <p class="muted" style="font-size:13px;margin-top:0">
              يمكنك رفع ملف CSV تم تصديره وتعديله عبر Excel، أو لصق نصوص CSV مباشرة في الصندوق أدناه:
            </p>
            <label style="font-size:12px;font-weight:bold">اختر ملف CSV من جهازك:</label>
            <input type="file" id="i18n_file_input" accept=".csv,text/csv" style="margin-bottom:12px" />
            
            <label style="font-size:12px;font-weight:bold">أو الصق محتوى CSV مباشرة:</label>
            <textarea id="i18n_csv_pasted" rows="6" placeholder="Key,Ar,Translation&#10;nav_palms,الأشجار والحقل,Palms & Field" style="width:100%;font-family:monospace;font-size:12px;box-sizing:border-box"></textarea>
          </div>
          <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
            <button class="btn btn-ghost" data-act="i18n-close-import">${t("btn_cancel", "إلغاء")}</button>
            <button class="btn btn-primary" data-act="i18n-exec-import">${t("btn_import", "استيراد وتطبيق الآن")}</button>
          </div>
        </div>
      </div>
    ` : ''}
  `;
}
function farmersView() {
  if (!hasPerm("farmers") && !hasPerm("farmers_view")) {
    return `<div class="card" style="padding:28px;text-align:center;margin-top:20px">
      <div style="font-size:36px;margin-bottom:8px">🔒</div>
      <h3 style="color:#b91c1c;margin:0 0 8px">عذراً، ليس لديك صلاحية استعراض المزارعين</h3>
      <div class="muted" style="font-size:13px;max-width:440px;margin:0 auto 16px">تم إلغاء صلاحيات الوصول إلى هذا الموديول لحسابك أو لدورك الحالي من قبل إدارة النظام.</div>
      <button class="btn btn-primary" data-go="dash">العودة للرئيسية</button>
    </div>`;
  }
  const st = Store.get();
  const list = st.farmers || [];
  const palms = st.palms;
  const me = session();
  const canManageFarmers = hasPerm("farmers_manage") || hasPerm("c", "farmers") || me?.role === "admin";
  const canDelFarmers = hasPerm("farmers_delete") || hasPerm("d", "farmers") || me?.role === "admin";
  return `<div class="page-head"><div><h3>إدارة المزارعين</h3><div class="muted">عقود الرعاية وإسناد القطع — منفصل عن العمال والمستثمرين</div></div>
      ${canManageFarmers ? `<button class="btn btn-primary icon-btn" data-go="farmer-new">إضافة مزارع</button>` : ""}</div>
    <div class="grid grid-3">
      <div class="card kpi"><div class="n">${list.length}</div><div class="l">مزارعون</div></div>
      <div class="card kpi"><div class="n">${list.filter(f=>f.status==="active").length}</div><div class="l">نشطون</div></div>
      <div class="card kpi"><div class="n">${list.reduce((a,f)=>a+(f.plots||[]).length,0)}</div><div class="l">قطع مسندة</div></div>
    </div>
    <div class="card" style="margin-top:12px"><div class="grid-wrap"><table class="dense">
      <thead><tr><th>المزارع</th><th>النوع</th><th>النطاق</th><th>العقد</th><th>النخيل</th><th>الحالة</th><th></th></tr></thead>
      <tbody>${list.map(f => {
        const n = palms.filter(p => (f.plots||[]).includes(p.plot)).length;
        return `<tr>
          <td><b>${escapeHtml(f.name)}</b><div class="muted">${escapeHtml(f.phone||"")}</div></td>
          <td>${f.type==="contract"?"عقد رعاية":"يومي"}</td>
          <td>${(f.plots||[]).map(escapeHtml).join("، ")||"—"}</td>
          <td>${escapeHtml(f.contractNo||"—")} ${f.sharePct?`• ${f.sharePct}%`:""}</td>
          <td>${n}</td>
          <td>${f.status==="active"?`<span class="status badge-ok">نشط</span>`:`<span class="status">موقوف</span>`}</td>
          <td class="row-acts">
            <button class="btn btn-ghost icon-btn" data-go="farmer" data-id="${f.id}">بطاقة</button>
            ${canManageFarmers ? `<button class="btn btn-ghost icon-btn" data-go="farmer-edit" data-id="${f.id}">✏️ تعديل</button>` : ""}
            ${canManageFarmers ? `<button class="btn btn-ghost icon-btn" data-act="tog-farmer" data-id="${f.id}">${f.status==="active"?"إيقاف":"تنشيط"}</button>` : ""}
            ${canDelFarmers ? `<button class="btn btn-ghost icon-btn" data-act="del-farmer" data-id="${f.id}" style="color:#DC2626">🗑️ حذف</button>` : ""}
          </td>
        </tr>`;
      }).join("")}</tbody>
    </table></div></div>`;
}
function farmerFormView(id) {
  const st = Store.get();
  const f = id ? (st.farmers || []).find(x => x.id === id) : null;
  const isEdit = Boolean(f);
  const selPlots = f?.plots || [];

  return `<div class="card" style="max-width:700px;margin:20px auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <button type="button" class="btn btn-ghost icon-btn" data-go="users" data-id="farmers">← رجوع لكشف العمال والمزارعين</button>
      <span class="badge" style="background:#F1F5F9;color:#475569">${isEdit ? 'تعديل سجل قائم' : 'تسجيل جديد'}</span>
    </div>
    <h3 style="margin-top:0">${isEdit ? `✏️ تعديل بيانات: ${escapeHtml(f.name)}` : "➕ إضافة عامل يومية / مزارع جديد"}</h3>
    
    <label>اسم العامل / المزارع <span style="color:#DC2626">*</span></label>
    <input id="fname" value="${f ? escapeHtml(f.name) : ""}" placeholder="الاسم ثلاثي أو ثنائي" />

    <div class="grid grid-2">
      <div>
        <label>رقم الجوال والتواصل</label>
        <input id="fphone" value="${f ? escapeHtml(f.phone || "") : ""}" placeholder="01xxxxxxxxx" />
      </div>
      <div>
        <label>الرقم القومي / الهوية</label>
        <input id="fnid" value="${f ? escapeHtml(f.nationalId || "") : ""}" placeholder="الرقم القومي المكون من 14 رقم" />
      </div>
    </div>

    <div class="grid grid-2">
      <div>
        <label>طبيعة التعاقد والعمل</label>
        <select id="ftype">
          <option value="daily" ${(!f || f?.type === "daily") ? "selected" : ""}>عمل باليومية (أجر يومي / حسب الطلب)</option>
          <option value="contract" ${f?.type === "contract" ? "selected" : ""}>عقد رعاية موسمي (مشاركة بالإنتاج)</option>
        </select>
      </div>
      <div>
        <label>أجر اليومية (ج.م / يوم) - لعمال اليومية</label>
        <input id="fdailywage" type="number" value="${f?.dailyWage || ''}" placeholder="مثال: 150" />
      </div>
    </div>

    <div class="grid grid-2">
      <div>
        <label>المهارة والتخصص الميداني</label>
        <select id="fspecialty">
          <option value="أعمال عامة" ${(!f?.specialty || f?.specialty==="أعمال عامة")?"selected":""}>أعمال عامة ونظافة</option>
          <option value="تلقيح" ${f?.specialty==="تلقيح"?"selected":""}>تلقيح النخيل</option>
          <option value="تقليم وتكريب" ${f?.specialty==="تقليم وتكريب"?"selected":""}>تقليم وتكريب وإزالة الرواكيب</option>
          <option value="ري وتسميد" ${f?.specialty==="ري وتسميد"?"selected":""}>تشغيل شبكات الري والتسميد</option>
          <option value="حصاد وفرز" ${f?.specialty==="حصاد وفرز"?"selected":""}>حصاد وفرز وتعبئة التمور</option>
          <option value="مكافحة آفات" ${f?.specialty==="مكافحة آفات"?"selected":""}>حقن ومكافحة سوسة النخيل</option>
        </select>
      </div>
      <div>
        <label>نسبة المشاركة % (لعقود الرعاية إن وجدت)</label>
        <input id="fshare" type="number" value="${f?.sharePct || 0}" />
      </div>
    </div>

    <div class="grid grid-2">
      <div>
        <label>رقم العقد (إن وجد)</label>
        <input id="fcon" value="${f ? escapeHtml(f.contractNo || "") : ""}" />
      </div>
      <div>
        <label>تاريخ البدء</label>
        <input id="fstart" type="date" value="${f?.start || ""}" />
      </div>
    </div>

    <label style="margin-top:8px">القطع المسندة للمتابعة</label>
    <div class="grid grid-3" style="max-height:160px;overflow-y:auto;background:#F8FAFC;padding:10px;border-radius:8px;border:1px solid #E2E8F0">
      ${st.plots.map(p=>`<label style="display:flex;align-items:center;gap:6px;font-size:12px;cursor:pointer"><input type="checkbox" class="fplot" value="${p.id}" ${selPlots.includes(p.id) ? "checked" : ""}> 📍 ${p.id}</label>`).join("")}
    </div>

    <label style="margin-top:8px">ملاحظات إضافية وسجل الأداء</label>
    <textarea id="fnotes" rows="2">${f ? escapeHtml(f.notes || "") : ""}</textarea>

    <div style="display:flex;gap:10px;margin-top:16px">
      <button type="button" class="btn btn-primary" data-act="save-farmer" data-id="${isEdit ? f.id : ""}" style="flex:1">${isEdit ? "💾 حفظ التعديلات" : "➕ حفظ وتسجيل العامل"}</button>
      <button type="button" class="btn btn-ghost" data-go="users" data-id="farmers">إلغاء</button>
    </div>
  </div>`;
}
function farmerView(id) {
  const st = Store.get();
  const f = (st.farmers||[]).find(x => x.id === id);
  if (!f) return `<div class="card">غير موجود</div>`;
  const me = session();
  const canManageFarmers = hasPerm("farmers_manage") || hasPerm("c", "farmers") || me?.role === "admin";
  const canDelFarmers = hasPerm("farmers_delete") || hasPerm("d", "farmers") || me?.role === "admin";
  const palms = st.palms.filter(p => (f.plots||[]).includes(p.plot));
  const ops = (_s => st.operations.filter(o => _s.has(o.palmId)))(new Set(palms.map(p => p.id))).length;
  const kg = st.yields.filter(y => (f.plots||[]).some(pid => y.plotId === pid || (y.plotId && y.plotId.startsWith("base:") && (pid.startsWith(y.plotId.slice(5)) || plotBaseId(pid) === y.plotId.slice(5))))).reduce((a,y)=>a+(+y.kg||0),0);
  return `<div class="page-head">
      <div><h3>${escapeHtml(f.name)}</h3></div>
      <div style="display:flex;gap:8px">
        ${canManageFarmers ? `<button class="btn btn-primary icon-btn" data-go="farmer-edit" data-id="${f.id}">✏️ تعديل</button>` : ""}
        ${canDelFarmers ? `<button class="btn btn-ghost icon-btn" data-act="del-farmer" data-id="${f.id}" style="color:#DC2626">🗑️ حذف</button>` : ""}
        <button class="btn btn-ghost icon-btn" data-go="users" data-id="farmers">رجوع لكشف العمال</button>
      </div>
    </div>
    <div class="grid grid-3">
      <div class="card kpi"><div class="n">${palms.length}</div><div class="l">نخيل النطاق</div></div>
      <div class="card kpi"><div class="n">${ops}</div><div class="l">عمليات مسجلة</div></div>
      <div class="card kpi"><div class="n">${kg}</div><div class="l">محصول كجم</div></div>
    </div>
    <div class="card" style="margin-top:12px">
      <p>الهوية: ${escapeHtml(f.nationalId||"—")} • ${escapeHtml(f.phone||"—")}</p>
      <p>النوع: ${f.type==="contract"?"عقد رعاية":"يومي"} • العقد ${escapeHtml(f.contractNo||"—")} • حصة ${f.sharePct||0}٪</p>
      <p>القطع: ${(f.plots||[]).map(escapeHtml).join("، ")}</p>
      <p class="muted">${escapeHtml(f.notes||"")}</p>
    </div>`;
}
function recvLabel(v) {
  return ({ both:"عينية ونقدية", in_kind:"عينية", cash:"نقدية" })[v] || v;
}

function invHomeView() {
  const st = Store.get();
  const palms = investorPalms();
  const shoots = palms.reduce((a,p)=>a+(p.offshootCount||0),0);
  const kg = st.yields.filter(y => palms.some(p => p.id===y.palmId || p.plot===y.plotId || (y.plotId && y.plotId.startsWith("base:") && (p.plot.startsWith(y.plotId.slice(5)) || plotBaseId(p.plot) === y.plotId.slice(5))))).reduce((a,y)=>a+(+y.kg||0),0);
  const z = st.zakat.find(x => x.investorId === session().id);
  const zlab = !z ? "بانتظار الإجراء" : z.status==="confirmed"||z.status==="approved"||z.status==="sent"||z.status==="received" ? "مفوّض" : "بانتظار الإجراء";
  const bySec = {};
  palms.forEach(p => {
    const sec = st.plots.find(x=>x.id===p.plot)?.sector || "—";
    bySec[sec] = bySec[sec] || {};
    bySec[sec][p.plot] = bySec[sec][p.plot] || [];
    bySec[sec][p.plot].push(p);
  });
  const byVar = {};
  palms.forEach(p => byVar[p.variety]=(byVar[p.variety]||0)+1);
  const photos = st.operations.filter(o => parsePhotos(o.photos).length && palms.some(p=>p.id===o.palmId)).slice(0,24);
  const tabs = [["map","خريطة أملاكي"],["var","الأصناف والإنتاج"],["plots","القطع والنخيل"],["gal","ألبوم المزرعة"]];
  let body = "";
  if (invTab === "var") {
    const maxv = Math.max(1, ...Object.values(byVar));
    body = `<div class="card">${Object.entries(byVar).map(([k,v])=>`<div class="bar-row"><div class="bar-lab">${k||"—"}</div><div class="bar-track"><div class="bar-fill" style="width:${Math.round(v/maxv*100)}%"></div></div><b>${v}</b></div>`).join("")||"<div class='muted'>لا بيانات</div>"}
      <p class="muted">متوسط ${(palms.length?kg/palms.length:0).toFixed(1)} كجم/نخلة هذا الموسم</p></div>`;
  } else if (invTab === "gal") {
    body = `<div class="card"><h3>تحديثات ميدانية ضمن نطاقك</h3>
      ${photos.map(o=>`<div class="photo-row">${parsePhotos(o.photos).map(s=>`<img class="thumb" src="${s}">`).join("")}<div class="muted">${typeName(o.typeId)} • ${fmtDate(o.at)}</div></div>`).join("")||"<div class='muted'>لا صور بعد في نطاقك</div>"}</div>`;
  } else if (invTab === "plots") {
    body = `<div class="card">${Object.keys(bySec).map(sec => {
      const plots = bySec[sec];
      const n = Object.values(plots).flat().length;
      return `<details class="tree-sec" open>
        <summary><b>${sectorName(sec)}</b> <span class="muted">${n} نخلة • ${Object.keys(plots).length} قطعة</span></summary>
        <table class="dense"><thead><tr><th>القطعة</th><th>النخيل</th><th>الأصناف</th><th>الحالة</th><th></th></tr></thead>
        <tbody>${Object.keys(plots).map(pid => {
          const list = plots[pid];
          const vars = [...new Set(list.map(p=>p.variety))].join("، ");
          const ok = list.filter(p=>p.status==="سليمة").length;
          return `<tr><td>${plotName(pid)}</td><td>${list.length}</td><td>${vars}</td><td>${ok}/${list.length} سليمة</td>
            <td><button class="btn btn-ghost icon-btn" data-act="inv-open-plot" data-id="${pid}">النخيل</button></td></tr>`;
        }).join("")}</tbody></table>
      </details>`;
    }).join("")}</div>`;
  } else {
    body = `<div class="card"><h3>خريطة نطاق استثمارك</h3><div id="farmmap" class="farm-map"></div></div>`;
  }
  const curUser = session() || {};
  const myContracts = (st.contracts || []).filter(c => 
    String(c.investorUserId) === String(curUser.id) || 
    String(c.investor_id) === String(curUser.id) ||
    String(c.investorId) === String(curUser.id) ||
    (curUser.contractIds || []).includes(c.id) ||
    (curUser.contractIds || []).includes(c.contractNumber) ||
    (curUser.contractIds || []).includes(c.contract_num)
  );

  let contractsHtml = "";
  if (myContracts.length > 0) {
    const hasAcreageBilling = myContracts.some(c => Number(c.annual_fee_per_acre || 0) > 0);
    const contractInvoices = st.contractInvoices || [];
    const myInvoices = contractInvoices.filter(inv => myContracts.some(c => String(c.id) === String(inv.contract_id || inv.contractId)));

    let cropBreakdownHtml = "";
    if (kg > 0) {
      const primaryContract = myContracts[0] || {};
      const tpl = (st.contractTemplates || []).find(t => t.id === primaryContract.template_id);
      const isZakatDel = !!primaryContract.zakat_delegated;
      const compPct = Number(primaryContract.company_crop_share_pct ?? (tpl?.default_company_share_pct ?? 25));
      const zakatPct = isZakatDel ? Number(primaryContract.zakat_rate_pct || 5.0) : 0;
      const invNetPct = Math.max(0, 100 - compPct - zakatPct);

      const compKg = Math.round((kg * compPct) / 100);
      const zakatKg = Math.round((kg * zakatPct) / 100);
      const invNetKg = Math.max(0, kg - compKg - zakatKg);

      cropBreakdownHtml = `
        <div class="card" style="margin:12px 0;background:#fff;border:1.5px solid #86EFAC;border-radius:14px;padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid #DCFCE7;padding-bottom:8px">
            <div style="font-weight:800;color:#166534;font-size:14px;display:flex;align-items:center;gap:6px">
              <span>⚖️</span> كشف توزيع المحصول والإنتاج العيني (موسم ${new Date().getFullYear()}م)
            </div>
            <span class="chip" style="background:#ECFDF5;color:#065F46;font-size:11px;font-weight:bold">احتساب تعاقدي آلي</span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:10px">
            <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:10px;text-align:center">
              <div class="muted" style="font-size:11px">إجمالي الإنتاج</div>
              <div style="font-size:17px;font-weight:800;color:#0F172A">${kg.toLocaleString()} كجم</div>
              <div style="font-size:10.5px;color:#64748B">100% المحصول</div>
            </div>
            <div style="background:#F0F9FF;border:1px solid #BAE6FD;border-radius:10px;padding:10px;text-align:center">
              <div class="muted" style="font-size:11px">مقتطع الشركة (إشراف)</div>
              <div style="font-size:17px;font-weight:800;color:#0284C7">${compKg.toLocaleString()} كجم</div>
              <div style="font-size:10.5px;color:#0369A1">% ${compPct} من الإنتاج</div>
            </div>
            <div style="background:#F0FDF4;border:1px solid #86EFAC;border-radius:10px;padding:10px;text-align:center">
              <div class="muted" style="font-size:11px">أمانات الزكاة الشرعية</div>
              <div style="font-size:17px;font-weight:800;color:#059669">${isZakatDel ? `${zakatKg.toLocaleString()} كجم` : '—'}</div>
              <div style="font-size:10.5px;color:#15803D">${isZakatDel ? '5% مفوضة للجمعيات' : 'غير مفوضة'}</div>
            </div>
            <div style="background:#ECFDF5;border:1.5px solid #10B981;border-radius:10px;padding:10px;text-align:center">
              <div class="muted" style="font-size:11px">صافي حصة المستثمر</div>
              <div style="font-size:17px;font-weight:800;color:#16A34A">${invNetKg.toLocaleString()} كجم</div>
              <div style="font-size:10.5px;color:#166534">% ${invNetPct} صافي مبرأ</div>
            </div>
          </div>
        </div>
      `;
    }

    let invoicesHtml = "";
    if (hasAcreageBilling) {
      invoicesHtml = `
        <div style="margin-top:14px;border-top:1px solid #E2E8F0;padding-top:12px">
          <div style="font-weight:800;color:#92400E;font-size:13.5px;margin-bottom:8px;display:flex;align-items:center;gap:6px">
            <span>💳</span> كشف حساب ومطالبات خدمة الفدان السنوية (عقد الرعاية والتشغيل)
          </div>
          ${myInvoices.length > 0 ? `
            <div class="grid-wrap" style="border:1px solid #E2E8F0;border-radius:8px;overflow:hidden">
              <table class="dense" style="width:100%">
                <thead style="background:#FFFBEB">
                  <tr>
                    <th>الموسم</th>
                    <th style="text-align:center">المساحة المخدومة</th>
                    <th style="text-align:center">تكلفة الفدان</th>
                    <th style="text-align:center">إجمالي المطالبة</th>
                    <th style="text-align:center">المسدد</th>
                    <th style="text-align:center">المتبقي</th>
                    <th style="text-align:center">حالة السداد</th>
                  </tr>
                </thead>
                <tbody>
                  ${myInvoices.map(inv => {
                    const remaining = Math.max(0, (inv.total_due_amount || 0) - (inv.paid_amount || 0));
                    const isFullyPaid = (inv.payment_status === 'paid') || remaining === 0;
                    return `
                      <tr>
                        <td style="font-weight:bold">موسم ${inv.season_year || '—'}م</td>
                        <td style="text-align:center">${Number(inv.total_area_acres || 0).toFixed(2)} فدان</td>
                        <td style="text-align:center">${Number(inv.fee_per_acre || 0).toLocaleString()} ج.م</td>
                        <td style="text-align:center;font-weight:bold;color:#0F172A">${Number(inv.total_due_amount || 0).toLocaleString()} ج.م</td>
                        <td style="text-align:center;color:#16A34A;font-weight:bold">${Number(inv.paid_amount || 0).toLocaleString()} ج.م</td>
                        <td style="text-align:center;color:${remaining > 0 ? '#DC2626' : '#64748B'};font-weight:bold">${remaining.toLocaleString()} ج.م</td>
                        <td style="text-align:center">
                          <span class="status ${isFullyPaid ? 'badge-ok' : 'badge-warn'}" style="font-size:11px">
                            ${isFullyPaid ? 'مسدد بالكامل ✅' : inv.paid_amount > 0 ? 'سداد جزئي ⏳' : 'بانتظار السداد ⌛'}
                          </span>
                        </td>
                      </tr>
                    `;
                  }).join("")}
                </tbody>
              </table>
            </div>
          ` : `
            <div style="background:#FFFBEB;border:1px dashed #FCD34D;border-radius:8px;padding:10px 14px;font-size:12px;color:#92400E">
              ℹ️ لا توجد مطالبات مسجلة بعد؛ يتم إصدار مطالبة الموسم تلقائياً وفق المساحة المربوطة بمحفظتك.
            </div>
          `}
        </div>
      `;
    }

    contractsHtml = `
      <div class="card" style="margin:12px 0;background:#F8FAFC;border:1.5px solid #CBD5E1;border-radius:14px;padding:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;border-bottom:1px solid #E2E8F0;padding-bottom:8px">
          <div style="font-weight:bold;color:#1E293B;font-size:14px;display:flex;align-items:center;gap:6px">
            <span>📜</span>
            <span>العقود الاستثمارية المرتبطة بمحفظتك (${myContracts.length})</span>
          </div>
          <span class="chip" style="background:#E2E8F0;color:#334155;font-weight:bold;font-size:11px">عقود موثقة رسمياً</span>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px">
          ${myContracts.map(c => {
            const cPlots = Array.isArray(c.plots) && c.plots.length > 0 
              ? c.plots 
              : (st.contractPlots || []).filter(cp => String(cp.contractId||cp.contract_id) === String(c.id)).map(cp => cp.plotId||cp.plot_id);
            
            const plotObjs = cPlots.map(pid => st.plots.find(p => p.id === pid)).filter(Boolean);
            const totalContractAcres = plotObjs.reduce((sum, p) => sum + (Number(p.areaValue || p.area_value) || 0), 0);
            const plotLabels = cPlots.length > 0 ? cPlots.map(pid => plotName(pid)).join("، ") : "القطع المسندة للمحفظة";
            
            const tpl = (st.contractTemplates || []).find(t => t.id === c.template_id);
            const tplName = tpl ? tpl.name_ar : (Number(c.annual_fee_per_acre || 0) > 0 ? 'عقد رعاية وتشغيل فداني' : 'مشاركة محضة في المحصول');
            const isZakat = !!c.zakat_delegated;
            const compShare = c.company_crop_share_pct ?? (tpl?.default_company_share_pct ?? 25);
            const invNet = c.investor_crop_share_pct ?? c.investor_share_pct ?? (100 - compShare - (isZakat ? 5 : 0));
            const feeAcre = Number(c.annual_fee_per_acre || 0);

            return `
              <div style="background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:14px;box-shadow:0 1px 3px rgba(0,0,0,0.04)">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:8px">
                  <div>
                    <div style="font-weight:800;font-size:15px;color:#0F172A">
                      ${escapeHtml(c.title || c.contractTitle || 'عقد استثماري')} 
                      <span class="chip" style="background:#EFF6FF;color:#1D4ED8;font-weight:bold;margin-right:6px;font-family:monospace">${escapeHtml(c.contract_num || c.contractNumber || c.id)}</span>
                    </div>
                    <div style="font-size:12px;color:#64748B;margin-top:4px">
                      <span>📍 القطع المشمولة: <b>${plotLabels}</b></span>
                      ${totalContractAcres > 0 ? ` • <span>المساحة: <b>${totalContractAcres.toFixed(2)} فدان</b></span>` : ''}
                      ${c.start_date || c.startDate ? ` • <span>📅 السريان: من <b>${c.start_date || c.startDate}</b> ${c.end_date || c.endDate ? `إلى <b>${c.end_date || c.endDate}</b>` : ''}</span>` : ''}
                    </div>
                  </div>
                  <span class="chip" style="background:#F1F5F9;color:#0F172A;font-weight:bold;font-size:11.5px">
                    📋 ${escapeHtml(tplName)}
                  </span>
                </div>

                <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding-top:8px;border-top:1px dashed #F1F5F9">
                  <span class="chip" style="background:#F0F9FF;color:#0369A1;font-weight:bold">🏢 حصة الشركة: ${compShare}%</span>
                  ${isZakat 
                    ? `<span class="chip" style="background:#ECFDF5;color:#065F46;font-weight:bold;border:1px solid #A7F3D0">🛡️ تفويض الزكاة: معتمد رسمياً بالعقد (5%)</span>`
                    : `<span class="chip" style="background:#FFFBEB;color:#92400E;font-size:11px">ℹ️ الزكاة: غير مفوضة (مسؤولية المستثمر)</span>`
                  }
                  <span class="chip" style="background:#ECFDF5;color:#047857;font-weight:800;border:1px solid #6EE7B7">🌾 صافي حصة المستثمر: ${invNet}%</span>
                  ${feeAcre > 0 ? `<span class="chip" style="background:#FEF3C7;color:#B45309;font-weight:bold">💼 رسم خدمة الفدان: ${feeAcre.toLocaleString()} ج.م/سنة (${c.payment_schedule || 'سنوي'})</span>` : ''}
                  <span class="chip" style="background:#F8FAFC;color:#334155;font-weight:bold">💰 ${c.financial_status || c.financialStatus || 'مسدد بالكامل'}</span>
                </div>
              </div>
            `;
          }).join("")}
        </div>
        ${invoicesHtml}
      </div>
      ${cropBreakdownHtml}
    `;
  }

  return `<div class="page-head"><div><h3>محفظة ${session().name||""}</h3></div>
      <button class="btn btn-ghost icon-btn" data-act="inv-pdf">تحميل تقرير المحفظة</button></div>
    <div class="grid grid-3">
      <div class="card kpi"><div class="n">${palms.length}</div><div class="l">نخيل مملوك</div></div>
      <div class="card kpi"><div class="n">${kg}</div><div class="l">إنتاج الموسم كجم</div></div>
      <div class="card kpi"><div class="n">${shoots}</div><div class="l">فسائل إجمالية</div></div>
    </div>
    ${contractsHtml}
    <div class="card" style="margin:10px 0" data-go="inv-zakat">الزكاة: <b>${zlab}</b> — اضغط لإدارة التفويض</div>
    <div class="card" style="margin:10px 0;background:linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 100%);border:1px solid #86efac;display:flex;align-items:center;gap:12px">
      <div style="font-size:26px">🛡️</div>
      <div style="flex:1">
        <div style="font-weight:bold;color:#166534;font-size:13px">درع الحماية والاستجابة الاستباقية للآفات (Proactive Crop Care)</div>
        <div style="font-size:12px;color:#15803d;margin-top:2px">تخضع مزارعكم لنظام الإنذار المبكر والمكافحة المتكاملة لضمان سلامة الثمار وجودة المحصول ووقاية الأشجار استباقياً.</div>
      </div>
    </div>
    <div class="ptabs">${tabs.map(([k,l])=>`<button class="${invTab===k?"on":""}" data-act="inv-tab" data-id="${k}">${l}</button>`).join("")}</div>
    ${body}`;
}
function invPalmsView(pid) {
  const st = Store.get();
  const base = investorPalms().filter(p => !pid || p.plot === pid);
  const vars = [...new Set(base.map(p => p.variety).filter(Boolean))];
  const secs = [...new Set(base.map(p => st.plots.find(x=>x.id===p.plot)?.sector).filter(Boolean))];
  const palms = base.filter(p => {
    if (invPalmQ && !normCode(p.code).includes(normCode(invPalmQ))) return false;
    if (invVarF && p.variety !== invVarF) return false;
    if (invSecF && st.plots.find(x=>x.id===p.plot)?.sector !== invSecF) return false;
    return true;
  });
  const shoots = base.reduce((a,p)=>a+(+p.offshootCount||0),0);
  const byVar = vars.map(v => `${base.filter(p=>p.variety===v).length} ${v}`).slice(0,4).join(" | ");
  return `<div class="page-head"><h3>${pid?plotName(pid):"نخيل محفظتك الاستثمارية"}</h3>
      <button class="btn btn-ghost icon-btn" data-go="inv-home">رجوع للمحفظة</button></div>
    <div class="dash-cols">
      <div class="card kpi"><div class="n">${base.length}</div><div class="l">إجمالي النخيل</div></div>
      <div class="card kpi"><div class="n">${vars.length}</div><div class="l">أصناف • ${byVar||"—"}</div></div>
      <div class="card kpi"><div class="n">${shoots}</div><div class="l">فسائل منتجة</div></div>
    </div>
    <div class="card filter-bar" style="grid-template-columns:1.4fr 1fr 1fr auto">
      <input id="invq" value="${invPalmQ}" placeholder="ابحث برقم الكود" />
      <select id="invvar"><option value="">كل الأصناف</option>${vars.map(v=>`<option ${invVarF===v?"selected":""}>${v}</option>`)}</select>
      <select id="invsec"><option value="">كل القطاعات</option>${secs.map(s=>`<option value="${s}" ${invSecF===s?"selected":""}>${sectorName(s)}</option>`)}</select>
      <button class="btn btn-ghost icon-btn" data-act="inv-filter">تصفية</button>
    </div>
    <div class="card" style="margin-top:10px"><div class="grid-wrap"><table class="dense">
      <thead><tr><th>الكود</th><th>الصنف</th><th>القطعة</th><th>الحالة</th><th>فسائل</th></tr></thead>
      <tbody>${palms.slice(0,80).map(p=>`<tr data-act="open-inv-palm" data-id="${p.id}" style="cursor:pointer">
        <td>${p.code}</td><td>${p.variety}</td><td>${plotName(p.plot)}</td>
        <td>${palmBadge(p)}</td>
        <td>${p.offshootCount?`<span class="chip">${p.offshootCount} فسائل</span>`:`<span class="muted">0</span>`}</td>
      </tr>`).join("")}</tbody>
    </table></div>
    <p class="muted">${palms.length} نخلة مطابقة من ${base.length}</p></div>`;
}
function invPalmView(id) {
  const p = investorPalms().find(x => x.id === id);
  if (!p) return `<div class="card">غير مصرح</div>`;
  const ops = Store.get().operations.filter(o => o.palmId === p.id);
  return `<div class="card">${codeHtml(p.code)}<p>${p.variety} — إجمالي الفسائل ${p.offshootCount||0}</p>
    <p class="muted">لا تُعرض تفاصيل الفسائل الفردية.</p></div>
    <div class="card" style="margin-top:12px"><h3>الخدمات</h3>
    ${ops.map(o=>`<div class="list-item"><div>${typeName(o.typeId)}<div class="muted">${fmtDate(o.at)}</div></div></div>`).join("")}</div>`;
}
function invZakatView() {
  const st = Store.get();
  const u = session();
  const seasons = getZakatSeasons(st);
  const curSeason = zakatSeason || "2026";

  const myContracts = (st.contracts || []).filter(c => 
    String(c.investorUserId) === String(u.id) || 
    String(c.investor_id) === String(u.id) ||
    String(c.investorId) === String(u.id) ||
    (u.contractIds || []).includes(c.id) ||
    (u.contractIds || []).includes(c.contractNumber) ||
    (u.contractIds || []).includes(c.contract_num)
  );
  const contractDelegated = myContracts.find(c => Number(c.zakat_delegated) === 1);
  const hasContractDelegation = !!contractDelegated;

  let z = st.zakat.find(x => x.investorId === u.id && String(x.season || "2026") === String(curSeason));
  if (!z) {
    z = {
      id: Store.uid("z"),
      investorId: u.id,
      season: curSeason,
      amount: 24750,
      dueKg: 250,
      cropId: "palm",
      choice: "in_kind",
      charityId: st.charities[0]?.id,
      status: hasContractDelegation ? "confirmed" : "pending",
      pledgeStatus: hasContractDelegation ? "signed" : "pending",
      journeyStage: hasContractDelegation ? "delegated" : "calculation",
      cancelRequested: false
    };
  } else if (hasContractDelegation) {
    z.pledgeStatus = "signed";
    if (z.journeyStage === "calculation") z.journeyStage = "delegated";
  }

  const myBatch = st.zakatBatches?.find(b => String(b.season || "2026") === String(curSeason) && (b.id === z.batchId || (b.investors && b.investors.some(i => i.investorId === u.id))));
  const ch = st.charities.find(c => c.id === (z.charityId || myBatch?.charityId)) || st.charities[0];
  const pol = st.settings.zakatPolicy;
  const isDelivered = (myBatch && myBatch.status === "delivered") || z.journeyStage === "delivered";
  const isSigned = z.pledgeStatus === "signed" || hasContractDelegation;
  const dueKg = z.dueKg || 250;
  const dueAmt = z.amount || (dueKg * 99);

  return `
    <div class="page-head" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <h3>⚖️ بوابة زكاة الزروع والثمار — موسم ${curSeason}م</h3>
        <div class="muted">خدمة احتساب وتوثيق إخراج الزكاة المعتمدة مع الجمعيات الشريكة</div>
      </div>
      <div class="row-acts" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:6px;background:#f1f5f9;padding:4px 10px;border-radius:8px;border:1px solid #cbd5e1">
          <span style="font-size:12.5px;font-weight:bold;color:#475569">📅 الموسم:</span>
          <select style="padding:4px 8px;border-radius:6px;border:1px solid #94a3b8;font-weight:bold;cursor:pointer" onchange="act('inv-zakat-change-season', this.value)">
            ${seasons.map(s => `<option value="${s}" ${String(s) === String(curSeason) ? 'selected' : ''}>موسم ${s}م</option>`).join("")}
          </select>
        </div>
        ${(!isSigned) ? `
          <button class="btn btn-ghost" disabled style="opacity:0.4;cursor:not-allowed" title="لا يمكن إصدار الشهادة: يرجى توقيع تفويض إخراج الزكاة أولاً">🔒 الشهادة مقفلة (بانتظار التفويض)</button>
        ` : (!myBatch && !isDelivered) ? `
          <button class="btn btn-ghost" disabled style="opacity:0.4;cursor:not-allowed" title="لا يمكن إصدار الشهادة: تم التوقيع وبانتظار قيام الشركة بإخراج الزكاة وتسليمها رسمياً للجمعية">⏳ بانتظار إخراج الزكاة من الشركة</button>
        ` : `
          <button class="btn btn-primary" data-act="zakat-view-cert" data-id="${u.id}">🏆 شهادة إبراء الذمة</button>
        `}
      </div>
    </div>

    ${hasContractDelegation ? `
      <div class="card" style="margin-bottom:14px;background:#ECFDF5;border:1.5px solid #6EE7B7;display:flex;align-items:center;gap:12px;padding:12px 16px">
        <div style="font-size:28px">🛡️</div>
        <div style="flex:1">
          <div style="font-weight:800;color:#065F46;font-size:13.5px">
            تفويض إخراج الزكاة معتمد وموثق رسمياً بموجب العقد الاستثماري (${escapeHtml(contractDelegated.contract_num || contractDelegated.id)})
          </div>
          <div style="font-size:12px;color:#047857;margin-top:2px">
            أنت مبرأ الذمة شرعياً؛ حيث تم تفويض الشركة رسمياً في العقد لاستقطاع نسبة الزكاة الشرعية (5%) وتوريدها للجمعيات الخيرية الشريكة وإصدار شهادات إبراء الذمة المعتمدة.
          </div>
        </div>
        <span class="badge" style="background:#059669;color:#fff;font-weight:bold;padding:4px 10px">مفوّض بالعقد ✅</span>
      </div>
    ` : ''}

    <!-- Quick Stats Grid -->
    <div class="grid grid-4" style="margin-bottom:14px">
      <div class="card kpi">
        <div class="n" style="color:var(--green-d)">${dueKg} كجم</div>
        <div class="l">النصاب الشرعي الواجب (5٪ ري صناعي)</div>
      </div>
      <div class="card kpi">
        <div class="n">${money(dueAmt)}</div>
        <div class="l">القيمة الشرعية المقدرة</div>
      </div>
      <div class="card kpi">
        <div class="n" style="font-size:16px;color:${isSigned ? 'var(--green-d)' : '#C85A2E'}">
          ${isSigned ? "مُفوض ومعتمد ✅" : "بانتظار التفويض ⏳"}
        </div>
        <div class="l">حالة تفويض الشركة</div>
      </div>
      <div class="card kpi">
        <div class="n" style="font-size:15px;color:#0284c7;font-family:monospace">
          ${myBatch?.receiptNo || z.receiptNo || "قيد التسليم للجمعية"}
        </div>
        <div class="l">رقم الإيصال الرسمي الصادر</div>
      </div>
    </div>

    <!-- 5-Step Visual Zakat Journey Stepper (Spacious & Clear Full-Width Card) -->
    <div class="card" style="margin-bottom:18px;background:#fff;border:1.5px solid #CBD5E1;border-radius:14px;padding:20px;box-shadow:0 2px 8px rgba(0,0,0,0.04)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
        <h4 style="margin:0;color:#166534;font-size:15px;display:flex;align-items:center;gap:8px;font-weight:800">
          <span>📍</span> مسار وتدفق إخراج زكاتك (Zakat Journey Tracker)
        </h4>
        <span class="chip" style="background:#ECFDF5;color:#065F46;font-size:12px;font-weight:700;border:1px solid #A7F3D0">
          🌱 تدفق موثق ومعتمد شرعياً
        </span>
      </div>
      <div class="zakat-stepper" style="margin:20px 0 10px;padding:10px 14px">
        <div class="zakat-step done">
          <div class="zakat-step-icon">⚖️</div>
          <div class="zakat-step-label">1. احتساب النصاب</div>
        </div>
        <div class="zakat-step ${isSigned ? 'done' : 'active'}">
          <div class="zakat-step-icon">${isSigned ? '✓' : '✍️'}</div>
          <div class="zakat-step-label">2. توقيع التعهد</div>
        </div>
        <div class="zakat-step ${isDelivered ? 'done' : (isSigned ? 'active' : '')}">
          <div class="zakat-step-icon">📦</div>
          <div class="zakat-step-label">3. الفرز والتجهيز</div>
        </div>
        <div class="zakat-step ${isDelivered ? 'done' : ''}">
          <div class="zakat-step-icon">🚚</div>
          <div class="zakat-step-label">4. التسليم للجمعية</div>
        </div>
        <div class="zakat-step ${isDelivered ? 'done' : ''}">
          <div class="zakat-step-icon">📜</div>
          <div class="zakat-step-label">5. إبراء الذمة والإيصال</div>
        </div>
      </div>
    </div>

    <!-- Pledge & Delegation Card -->
    <div class="card" style="margin-bottom:14px;border-right:4px solid ${isSigned ? 'var(--green)' : '#C85A2E'}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
        <div>
          <h4 style="margin:0">📜 نموذج وسياسة تفويض الشركة في إخراج الزكاة (${curSeason}م)</h4>
          <div class="muted" style="font-size:12px;margin-top:2px">
            وفق وثيقة الخدمة المعتمدة (${pol?.version || "إصدار 2.1"})
          </div>
        </div>
        <span class="badge ${isSigned ? 'badge-ok' : 'st-sync'}">
          ${isSigned ? "مُفوض ومُوقع رسمياً ✅" : "يتطلب توقيعك ✍️"}
        </span>
      </div>

      <div style="margin:12px 0;padding:10px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;font-size:12.5px;line-height:1.7">
        ${escapeHtml(pol?.terms || "يفوض المستثمر إدارة المزرعة في جذاذ واحتساب نصاب الزكاة الشرعي وتسليمه للجمعيات المعتمدة.")}
      </div>

      <!-- Preferred Charity Selection -->
      <div style="margin:10px 0 14px;padding:10px 12px;background:#f0fdf4;border:1.5px solid #86efac;border-radius:8px">
        <label style="font-weight:700;color:#166534;font-size:12.5px;display:flex;align-items:center;gap:6px;margin-bottom:6px">
          🏛️ الجمعية الخيرية المعتمدة المرغوب إيصال زكاتك إليها:
        </label>
        ${!isDelivered ? `
          <select id="inv-charity-pref" data-act="inv-set-charity" style="width:100%;padding:7px 10px;font-size:13px;border-radius:6px;border:1.5px solid var(--green);font-weight:700;background:#fff">
            ${st.charities.filter(c => !c.hidden).map(c => `
              <option value="${c.id}" ${c.id === (z.charityId || st.charities[0]?.id) ? "selected" : ""}>${c.name} (ترخيص: ${c.licenseNo}) - ${c.address}</option>
            `).join("")}
          </select>
          <div class="muted" style="font-size:11px;margin-top:5px">
            💡 سيتم إدراج زكاتك ضمن شحنة مجمعة موجهة خصيصاً لهذه الجمعية وتوثيق إيصال رسمي باسمك.
          </div>
        ` : `
          <div style="font-weight:bold;color:#15803d;font-size:13.5px">
            🏛️ ${ch?.name} (ترخيص: ${ch?.licenseNo})
          </div>
        `}
      </div>

      ${isSigned ? `
        <div style="display:flex;align-items:center;justify-content:space-between;background:#ecfdf5;border:1px solid #a7f3d0;padding:10px 14px;border-radius:8px;flex-wrap:wrap;gap:8px">
          <div>
            <b style="color:#065f46">✓ تم اعتماد وتوقيع نموذج التعهد والتفويض رسمياً</b>
            <div style="font-size:11.5px;color:#047857">
              بتاريخ ${fmtDate(z.pledgeSignedAt || (curSeason + "-08-15"))} • وثيقة التفويض سارية لموسم ${curSeason}م.
            </div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-primary" data-act="zakat-preview-signed" data-id="${u.id}">📄 عرض وثيقة التعهد</button>
            <button class="btn btn-ghost" data-act="zakat-print-pledge" data-id="${u.id}">🖨️ طباعة نسخة</button>
          </div>
        </div>
      ` : `
        <div style="background:#fff7ed;border:1px solid #fdba74;padding:12px;border-radius:8px">
          <b style="color:#9a3412">لم تقم بتفويض الشركة لإخراج زكاة محصولك لهذا الموسم (${curSeason}م) بعد:</b>
          <p style="margin:4px 0 10px;font-size:12.5px;color:#c2410c">
            يمكنك إتمام التفويض إلكترونياً بضغطة زر، أو طباعة النموذج والتوقيع يدوياً ثم رفعه.
          </p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn btn-primary" data-act="zakat-investor-sign-pledge">✍️ توقيع وتفويض إلكتروني فوري (E-Sign)</button>
            <button class="btn btn-ghost" data-act="zakat-print-empty-pledge">🖨️ طباعة النموذج فارغاً للتوقيع</button>
            <button class="btn btn-ghost" data-act="zakat-upload-signed-pledge">📤 رفع النموذج الموقع</button>
          </div>
        </div>
      `}
    </div>

    <!-- Official Donation Receipt Card with Privacy Masking -->
    ${myBatch ? `
      <div class="card" style="margin-bottom:14px;border:2px solid #0284c7">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;border-bottom:1px solid #e2e8f0;padding-bottom:10px;margin-bottom:12px">
          <div>
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:22px">🏛️</span>
              <h4 style="margin:0;color:#0369a1">${ch?.name || "جمعية البر الخيرية"}</h4>
              <span class="badge badge-ok">إيصال رسمي معتمد ✓</span>
            </div>
            <div class="muted" style="font-size:12px;margin-top:2px">
              ترخيص رسمي: <b>${ch?.licenseNo || "1042 / 2018"}</b> • تاريخ التسليم: ${fmtDate(myBatch.date)}
            </div>
          </div>
          <div style="text-align:left">
            <div style="font-family:monospace;font-size:16px;font-weight:bold;color:#0369a1">
              رقم الإيصال: ${myBatch.receiptNo}
            </div>
            <div class="muted" style="font-size:11px">شحنة مجمعة: ${myBatch.batchNo}</div>
          </div>
        </div>

        <div style="margin-bottom:12px;font-size:13px;line-height:1.6">
          تشهد الجمعية باستلام إرسالية زكاة مجمعة بإجمالي <b>${myBatch.totalKg} كجم (${myBatch.variety || "خلاص فاخر"})</b>
          بقيمة إجمالية مقدرة بـ <b>${money(myBatch.totalAmount || 0)}</b>، وتم توزيعها على مستحقيها من الأسر المتعففة.
        </div>

        <!-- Privacy Shield Banner -->
        <div style="background:#f0f9ff;border-right:4px solid #0284c7;padding:8px 12px;border-radius:4px;margin-bottom:10px;font-size:12px;color:#0369a1">
          🔒 <b>حماية سرية البيانات والخصوصية:</b> يتم حجب أسماء وأرقام هواتف شركاء الخير المشاركين في نفس الإرسالية جزئياً حمايةً للخصوصية مع إظهار أوزان المساهمة للشفافية والمصداقية الشرعية.
        </div>

        <!-- Co-Donors Table with Masking -->
        <div class="grid-wrap">
          <table class="dense">
            <thead>
              <tr>
                <th>المستثمر المساهم</th>
                <th>رقم الهاتف الموثق</th>
                <th>كمية الزكاة المخرجة</th>
                <th>القيمة الشرعية</th>
                <th>حالة المساهمة</th>
              </tr>
            </thead>
            <tbody>
              ${(myBatch.investors || []).map(item => {
                const isMe = item.investorId === u.id;
                return `
                  <tr style="${isMe ? 'background:#ecfdf5;font-weight:bold' : ''}">
                    <td>
                      ${isMe
                        ? `<span style="color:#166534">⭐ أنت (${item.name})</span>`
                        : `<span class="masked-code">${maskName(item.name)}</span>`}
                    </td>
                    <td>
                      ${isMe
                        ? `<span class="masked-code" style="background:#d1fae5;color:#065f46">${item.phone || u.phone || "—"}</span>`
                        : `<span class="masked-code">${maskPhone(item.phone)}</span>`}
                    </td>
                    <td style="color:${isMe ? 'var(--green-d)' : 'inherit'}">
                      ${item.kg} كجم
                    </td>
                    <td>
                      ${money(item.amount)}
                    </td>
                    <td>
                      <span class="badge badge-ok">تم الصرف والتوزيع ✓</span>
                    </td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </div>

        <div class="row-acts" style="margin-top:12px">
          <button class="btn btn-primary" data-act="zakat-print-receipt" data-id="${myBatch.id}">🖨️ طباعة إيصال الجمعية الرسمي</button>
        </div>
      </div>
    ` : `
      <div class="card" style="margin-bottom:14px;background:#f8fafc;text-align:center;padding:24px">
        <div style="font-size:32px;margin-bottom:6px">🚚</div>
        <h4>إرسالية الزكاة قيد الجدولة والتجهيز</h4>
        <p class="muted" style="font-size:12.5px;max-width:500px;margin:0 auto">
          يجري حالياً تنسيق مواعيد التسليم مع الجمعيات الخيرية الشريكة لموسم ${curSeason}م. بمجرد تسليم الشحنة، سيظهر هنا الإيصال الرسمي المعتمد وجدول شركاء الخير.
        </p>
      </div>
    `}

    <!-- Certificate Promo Card -->
    <div class="card" style="background:linear-gradient(135deg, #fefce8 0%, #fef9c3 100%);border:1px solid #fde047;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div>
        <h4 style="margin:0;color:#854d0e">🏆 شهادة إبراء الذمة وشكر وتقدير</h4>
        <p style="margin:4px 0 0;font-size:12.5px;color:#a16207">
          شهادة شكر وتقدير رسمية موثقة ومعتمدة زكوياً لموسم ${curSeason}م جاهزة للتحميل والطباعة.
        </p>
      </div>
      ${(!isSigned) ? `
        <button class="btn btn-ghost" disabled style="opacity:0.4;cursor:not-allowed">🔒 مقفلة (تتطلب تفويض الزكاة)</button>
      ` : (!myBatch && !isDelivered) ? `
        <button class="btn btn-ghost" disabled style="opacity:0.4;cursor:not-allowed">⏳ مقفلة (بانتظار إخراج الزكاة)</button>
      ` : `
        <button class="btn btn-primary" data-act="zakat-view-cert" data-id="${u.id}">📜 استعراض وطباعة الشهادة</button>
      `}
    </div>

    ${showCertModal ? zakatCertModalHtml(st) : ""}
    ${showSignedDocModal ? zakatSignedDocModalHtml(st) : ""}
    ${showPrintPledgeModal ? zakatPrintPledgeModalHtml(st) : ""}
  `;
}
function invPhotosView() {
  const photos = Store.get().operations.filter(o => parsePhotos(o.photos).length && investorPalms().some(p=>p.id===o.palmId));
  return `<div class="card"><h3>الصور</h3>
    ${photos.map(o=>`<div class="photo-row">${parsePhotos(o.photos).map(s=>`<img class="thumb" src="${s}">`).join("")}</div>`).join("") || "<div class='muted'>لا توجد صور</div>"}
  </div>`;
}

