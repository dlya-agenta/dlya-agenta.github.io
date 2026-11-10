// v5.48 G (Алексей 10.11, п. 24): видео эксклюзива — до 2 минут, файл не больше 20 МБ. Сжимает сам браузер (без сервера):
// видео проигрывается без звука для человека (звук идёт только в запись через WebAudio), кадры рисуются на холст до 1280 px по длинной стороне,
// MediaRecorder пишет MP4 (H.264, Safari и новый Chrome) или WebM с битрейтом под 20 МБ. Время сжатия ≈ длительность ролика.
// Файл уже подходит (MP4/WebM, ≤ 20 МБ, ≤ 2 мин) — без сжатия. window.VIDPACK.pack(file, onProgress) → { blob, type: 'mp4' | 'webm', sec, packed }
(() => {
  const MAX = 20_000_000, SEC = 120, SIDE = 1280;
  const mime = () => ['video/mp4;codecs=avc1.42E01F,mp4a.40.2', 'video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    .find(t => window.MediaRecorder?.isTypeSupported?.(t)) ?? '';
  const fail = t => { throw new Error(t); };
  function meta(url) {
    return new Promise((ok, no) => {
      const v = document.createElement('video');
      v.preload = 'metadata'; v.playsInline = true; v.muted = true; v.src = url;
      v.onloadedmetadata = () => ok(v);
      v.onerror = () => no(new Error('Это видео браузер открыть не может — сохраните его на телефоне как MP4 и попробуйте снова'));
    });
  }
  async function encode(url, sec, kbps, onProgress) {
    const v = await meta(url);   // каждый раз новый элемент: WebAudio подключается к элементу один раз
    const k = Math.min(1, SIDE / Math.max(v.videoWidth, v.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(v.videoWidth * k / 2) * 2; c.height = Math.round(v.videoHeight * k / 2) * 2;
    const g = c.getContext('2d'), stream = c.captureStream(30);
    let ac = null;
    try {   // звук: в запись, но не в динамики
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const src = ac.createMediaElementSource(v), dst = ac.createMediaStreamDestination();
      src.connect(dst); dst.stream.getAudioTracks().forEach(t => stream.addTrack(t));
      await ac.resume?.();
    } catch { /* без звука */ }
    const type = mime();
    if (!type) fail('Этот браузер не умеет сжимать видео — откройте сайт в Chrome или Safari');
    const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: kbps * 1000, audioBitsPerSecond: 96_000 }), parts = [];
    rec.ondataavailable = e => { if (e.data.size) parts.push(e.data); };
    v.muted = false; v.volume = 1; v.currentTime = 0;
    await new Promise(r => { if (v.readyState >= 2) r(); else v.oncanplay = r; });
    rec.start(1000);
    const draw = () => { g.drawImage(v, 0, 0, c.width, c.height); onProgress?.(Math.min(1, v.currentTime / sec)); };
    await new Promise((ok, no) => {
      const tick = () => { if (v.ended || v.paused && v.currentTime >= sec - .05) return ok(); draw();
        v.requestVideoFrameCallback ? v.requestVideoFrameCallback(tick) : requestAnimationFrame(tick); };
      v.onended = () => ok();
      v.onerror = () => no(new Error('Видео оборвалось при сжатии'));
      v.play().then(tick, er => no(new Error(`Видео не запустилось: ${er.message}`)));
    });
    draw();
    rec.stop(); await new Promise(r => rec.onstop = r);
    stream.getTracks().forEach(t => t.stop()); ac?.close?.();
    const blob = new Blob(parts, { type: type.split(';')[0] });
    if (!blob.size) fail('Видео не сжалось — попробуйте в Chrome или Safari');
    return blob;
  }
  async function pack(file, onProgress) {
    if (!/^video\//.test(file.type) && !/\.(mp4|mov|m4v|webm|3gp)$/i.test(file.name)) fail('Это не видео');
    const url = URL.createObjectURL(file);
    try {
      const v = await meta(url), sec = v.duration;
      if (!Number.isFinite(sec) || sec <= 0) fail('Не удалось узнать длину видео');
      if (sec > SEC + 1) fail(`Видео ${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, '0')} — нужно не длиннее 2 минут. Обрежьте его на телефоне и загрузите снова`);
      const ok = /^video\/(mp4|webm)$/.test(file.type) && file.size <= MAX && Math.max(v.videoWidth, v.videoHeight) <= 1920;
      if (ok) return { blob: file, type: file.type.includes('webm') ? 'webm' : 'mp4', sec: Math.round(sec), packed: false };
      // битрейт под 20 МБ с запасом 8 % (MediaRecorder держит его примерно): звук 96 кбит/с
      let kbps = Math.max(350, Math.min(2500, Math.floor((MAX * .92 * 8 / sec) / 1000) - 110));
      for (let t = 0; t < 3; t++) {
        const blob = await encode(url, sec, kbps, p => onProgress?.(p, t));
        if (blob.size <= MAX) return { blob, type: blob.type.includes('webm') ? 'webm' : 'mp4', sec: Math.round(sec), packed: true };
        kbps = Math.floor(kbps * MAX / blob.size * .85);
      }
      fail('Не получилось сжать видео до 20 МБ — укоротите его');
    } finally { URL.revokeObjectURL(url); }
  }
  window.VIDPACK = { pack, MAX, SEC };
})();
