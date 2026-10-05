// PalmTrace app — Global listeners and startup
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && activeDrawerEventId) {
    activeDrawerEventId = null;
    render();
  }
});

window.addEventListener("load", () => {
  try {
    const st = Store.get();
    if (!st.settings?.showLangToggle && typeof I18n !== "undefined" && I18n.getLang() !== "ar") {
      I18n.setLang("ar");
    }
  } catch (e) {}
  migrateOffshootCodes();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js?v=164").then(reg => {
      reg.update().catch(() => {});
    }).catch(() => {});
  }
  render();

  // Smart Polling loop for live activity stream (every 35s)
  setInterval(() => {
    try {
      if (typeof current !== "undefined" && current !== "dash") return;
      const st = Store.get();
      const currentOpCount = (st.operations || []).length + (st.incidents || []).length;
      if (lastFeedKnownOpCount === 0) {
        lastFeedKnownOpCount = currentOpCount;
      } else if (currentOpCount > lastFeedKnownOpCount) {
        const newItems = (currentOpCount - lastFeedKnownOpCount);
        feedNewItemsCount += newItems;
        lastFeedKnownOpCount = currentOpCount;
        triggerPulseNotification(newItems);
        render();
      }
    } catch (err) {}
  }, 35000);
});
window.addEventListener("online", () => {
  toast("📡 عادت الشبكة — جاري مزامنة العمليات المعلقة...");
  const isEditing = (typeof isUserEditingOrFormActive === "function") ? isUserEditingOrFormActive() : false;
  if (!isEditing && typeof render === "function") render();
  if (typeof Api !== "undefined") {
    Api.syncQueue().then(() => {
      const stillEditing = (typeof isUserEditingOrFormActive === "function") ? isUserEditingOrFormActive() : false;
      if (!stillEditing && typeof render === "function") render();
    });
  }
});
window.addEventListener("offline", () => {
  toast("📴 انقطع الاتصال — العمل مستمر محلياً دون توقف");
  // Never re-render on offline event, to protect all active user inputs and ongoing form edits!
});