// Ghi âm ngắn trong bộ nhớ (không lưu lâu dài) + đọc mẫu bằng giọng máy.
import { toast } from './ui.js';
import { audioEl, stop as stopAudio } from './audio.js';

export function speakEn(text, rate = 0.85) {
  return new Promise((resolve) => {
    try {
      if (!('speechSynthesis' in window)) { toast('Máy này không đọc được văn bản.'); resolve(); return; }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = rate;
      const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.startsWith('en-US'));
      if (v) u.voice = v;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      speechSynthesis.speak(u);
    } catch (e) { resolve(); }
  });
}

export function createRecorder() {
  let rec = null, stream = null, chunks = [], url = null;
  return {
    get url() { return url; },
    get recording() { return !!(rec && rec.state === 'recording'); },
    async start() {
      if (!navigator.mediaDevices || !window.MediaRecorder) { toast('Trình duyệt này không hỗ trợ ghi âm.'); return false; }
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { toast('Chưa có quyền dùng micro.'); return false; }
      chunks = [];
      rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
      rec.start();
      return true;
    },
    stop() {
      return new Promise((resolve) => {
        if (!rec || rec.state !== 'recording') { resolve(url); return; }
        rec.onstop = () => {
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }));
          if (stream) stream.getTracks().forEach((t) => t.stop());
          stream = null;
          resolve(url);
        };
        rec.stop();
      });
    },
    play() {
      return new Promise((resolve) => {
        if (!url) { resolve(); return; }
        stopAudio();
        const a = audioEl();
        a.onended = () => resolve();
        a.onerror = () => resolve();
        a.src = url;
        a.playbackRate = 1; a.defaultPlaybackRate = 1;
        const p = a.play();
        if (p && p.catch) p.catch(() => resolve());
      });
    },
  };
}
