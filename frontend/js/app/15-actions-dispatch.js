// PalmTrace app — Action dispatcher: tries each handler part in order (same order as the former single act())
// (split from the former single app.js; files are classic scripts loaded in order by index.html)

// Returned by a handler part when none of its actions matched.
const ACT_NEXT = Symbol('act-next');

async function act(name, id, el) {
  const st = Store.get();
  const parts = [actionsPart01, actionsPart02, actionsPart03, actionsPart04, actionsPart05, actionsPart06, actionsPart07, actionsPart08, actionsPart09];
  for (const part of parts) {
    const result = await part(name, id, el, st);
    if (result !== ACT_NEXT) return result;
  }
}
