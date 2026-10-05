/**
 * UUIDv7 Generator (RFC 9562) - Browser / PWA Client
 * توليد معرّفات مرتبة زمنياً للعمليات الحقلية غير المتصلة (Offline-First)
 */
const UuidV7 = (() => {
  let lastTime = -1;
  let seq = 0;

  function uuidv7(timestamp) {
    let now = timestamp ? (typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime()) : Date.now();
    if (isNaN(now)) now = Date.now();
    if (now === lastTime) {
      seq = (seq + 1) & 0x0fff;
      if (seq === 0) {
        now = lastTime + 1;
      }
    } else {
      lastTime = now;
      seq = Math.floor(Math.random() * 0x0fff);
    }

    const bytes = new Uint8Array(16);

    // 48-bit timestamp
    bytes[0] = (now / 0x10000000000) & 0xff;
    bytes[1] = (now / 0x100000000) & 0xff;
    bytes[2] = (now / 0x1000000) & 0xff;
    bytes[3] = (now / 0x10000) & 0xff;
    bytes[4] = (now / 0x100) & 0xff;
    bytes[5] = now & 0xff;

    // 4-bit ver (7) & 12-bit seq
    bytes[6] = 0x70 | ((seq >> 8) & 0x0f);
    bytes[7] = seq & 0xff;

    // 62-bit rand
    if (window.crypto && window.crypto.getRandomValues) {
      const rand = new Uint8Array(8);
      window.crypto.getRandomValues(rand);
      for (let i = 0; i < 8; i++) bytes[8 + i] = rand[i];
    } else {
      for (let i = 8; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  return { generate: uuidv7, uuidv7 };
})();

