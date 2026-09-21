// scene.js — 峡谷夜景背景（落地页与游戏登录/选人界面共用，零依赖）
// 用法：CanyonScene.start(canvas) 启动，CanyonScene.stop() 停止，CanyonScene.draw() 画一帧
const CanyonScene = (() => {
  let cv = null, sg = null, SW = 0, SH = 0, dpr = 1, raf = 0, tSec = 0;
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mouse = { x: 0.5, y: 0.5 };
  let ridges = [], stars = [], motes = [], bushes = [];

/* ================= 峡谷场景 ================= */
function buildScene() {
  const hz = SH * 0.62;                          // 地平线
  // 灌木：沿近景山脊散布，填补画面下方的空地
  bushes = Array.from({ length: 7 }, () => ({
    x: Math.random() * SW, y: hz + 60 + Math.random() * (SH - hz - 50),
    r: 12 + Math.random() * 16
  }));
  // 三层山脊：每条都是稳定的谐波曲线，只按视差整体平移，不会闪烁
  const mk = (base, amp, seed, step) => {
    const pts = [];
    for (let x = -80; x <= SW + 80; x += step)
      pts.push([x, base - amp * (0.55 * Math.sin(x * 0.0042 + seed)
        + 0.3 * Math.sin(x * 0.0113 + seed * 2.3)
        + 0.15 * Math.sin(x * 0.0231 + seed * 3.7))]);
    return { pts, base, amp };
  };
  ridges = [ mk(hz + 6,  46, 1.7, 26), mk(hz + 26, 62, 4.2, 22), mk(hz + 54, 84, 6.1, 18) ];
  stars = Array.from({ length: 70 }, () => ({
    x: Math.random() * SW, y: Math.random() * hz * 0.9,
    r: Math.random() * 1.4 + 0.5, p: Math.random() * 6.28, s: 0.6 + Math.random()
  }));
  motes = Array.from({ length: 54 }, () => ({
    x: Math.random() * SW, y: Math.random() * SH,
    r: Math.random() * 1.6 + 0.5, v: 5 + Math.random() * 14, p: Math.random() * 6.28
  }));
}
function drawScene(t, mx, my) {
  const hz = SH * 0.62;
  // 天空
  const sky = sg.createLinearGradient(0, 0, 0, SH);
  sky.addColorStop(0, '#1b2942'); sky.addColorStop(0.5, '#2c4062'); sky.addColorStop(1, '#3f5a80');
  sg.fillStyle = sky; sg.fillRect(0, 0, SW, SH);
  // 地平线辉光
  const glow = sg.createRadialGradient(SW * 0.5, hz, 8, SW * 0.5, hz, SW * 0.6);
  glow.addColorStop(0, 'rgba(150,205,245,.5)'); glow.addColorStop(1, 'rgba(150,205,245,0)');
  sg.fillStyle = glow; sg.fillRect(0, 0, SW, SH);
  // 星点（闪烁）
  stars.forEach(s => {
    const a = 0.5 + 0.5 * (0.5 + 0.5 * Math.sin(t * s.s + s.p));
    sg.fillStyle = 'rgba(220,235,255,' + a.toFixed(3) + ')';
    sg.beginPath(); sg.arc(s.x, s.y, s.r, 0, 7); sg.fill();
  });
  // 三层山脊（鼠标视差）
  const cols = ['#33496e', '#27374f', '#1a2637'];
  const depths = [10, 20, 34];
  ridges.forEach((r, i) => {
    const dx = mx * depths[i];
    sg.fillStyle = cols[i];
    sg.beginPath(); sg.moveTo(-80, SH);
    r.pts.forEach(p => sg.lineTo(p[0] + dx, p[1]));
    sg.lineTo(SW + 80, SH); sg.closePath(); sg.fill();
  });
  // 中央河道：两条波光带
  const rw = Math.min(150, SW * 0.1), rcx = SW * 0.5 + mx * 26;
  const rg = sg.createLinearGradient(0, hz + 30, 0, SH);
  rg.addColorStop(0, '#2f6a9e'); rg.addColorStop(1, '#1e3c5e');
  sg.fillStyle = rg;
  sg.beginPath();
  sg.moveTo(rcx - rw * 0.55, hz + 30);
  sg.lineTo(rcx + rw * 0.55, hz + 30);
  sg.lineTo(rcx + rw, SH); sg.lineTo(rcx - rw, SH);
  sg.closePath(); sg.fill();
  sg.strokeStyle = 'rgba(175,220,255,.26)'; sg.lineWidth = 2; sg.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const y = hz + 40 + ((t * 26 + i * 46) % (SH - hz));
    const k = (y - hz) / (SH - hz), w = rw * (0.5 + k);
    sg.beginPath();
    sg.moveTo(rcx - w + Math.sin(t * 2 + i) * 6, y);
    sg.lineTo(rcx + w + Math.sin(t * 2 + i) * 6, y);
    sg.stroke();
  }
  // 车道分隔线：两条平行于河道边缘的长线 + 等距横向刻度（像游戏里的兵线）
  sg.strokeStyle = 'rgba(190,230,255,.22)'; sg.lineWidth = 1.5;
  [0.28, 0.72].forEach(f => {
    sg.beginPath();
    sg.moveTo(rcx - rw * (1 - f), hz + 30);
    sg.lineTo(rcx - rw * (2 * f), SH);
    sg.stroke();
    sg.beginPath();
    sg.moveTo(rcx + rw * (1 - f), hz + 30);
    sg.lineTo(rcx + rw * (2 * f), SH);
    sg.stroke();
  });
  sg.strokeStyle = 'rgba(190,230,255,.16)'; sg.lineWidth = 2;
  for (let y = hz + 56; y < SH; y += 54) {
    const k = (y - hz) / (SH - hz), w = rw * (0.5 + k) * 0.82;
    sg.beginPath(); sg.moveTo(rcx - w, y); sg.lineTo(rcx + w, y); sg.stroke();
  }
  // 地图装饰：外侧防御塔 + 灌木（填补左右下方的空地）
  const tower = (x, y, sc) => {
    sg.fillStyle = '#131f33';
    sg.fillRect(x - 9 * sc, y - 34 * sc, 18 * sc, 34 * sc);
    sg.fillRect(x - 13 * sc, y - 41 * sc, 26 * sc, 8 * sc);
    sg.fillRect(x - 4 * sc, y - 51 * sc, 8 * sc, 11 * sc);
  };
  tower(SW * 0.07, hz + 92, 1.15);
  tower(SW * 0.93, hz + 92, 1.15);
  sg.fillStyle = '#16351f';
  bushes.forEach(b => {
    sg.beginPath(); sg.ellipse(b.x, b.y, b.r, b.r * 0.5, 0, 0, 7); sg.fill();
  });
  // 双方水晶 + 防御塔剪影
  const crystal = (x, col) => {
    const pulse = 0.6 + 0.4 * Math.sin(t * 1.6 + x);
    const y = hz + 34;
    const cg = sg.createRadialGradient(x, y, 2, x, y, 70);
    cg.addColorStop(0, col.replace('1)', (0.65 * pulse + 0.3).toFixed(2) + ')'));
    cg.addColorStop(1, col.replace('1)', '0)'));
    sg.fillStyle = cg;
    sg.beginPath(); sg.arc(x, y, 70, 0, 7); sg.fill();
    sg.fillStyle = col.replace('1)', '0.9)');
    sg.beginPath();
    sg.moveTo(x, y - 16); sg.lineTo(x + 9, y); sg.lineTo(x, y + 16); sg.lineTo(x - 9, y);
    sg.closePath(); sg.fill();
    // 塔剪影
    sg.fillStyle = '#0d141f';
    sg.fillRect(x + (x < SW / 2 ? 34 : -50), y - 26, 16, 26);
    sg.fillRect(x + (x < SW / 2 ? 30 : -54), y - 32, 24, 7);
  };
  crystal(SW * 0.16 + mx * 14, 'rgba(63,140,255,1)');
  crystal(SW * 0.84 + mx * 14, 'rgba(255,82,82,1)');
  // 上浮光尘
  motes.forEach(m => {
    const y = reduced ? m.y : (m.y - t * m.v) % SH;
    const yy = y < 0 ? y + SH : y;
    const a = 0.22 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.4 + m.p));
    sg.fillStyle = 'rgba(205,232,255,' + a.toFixed(3) + ')';
    sg.beginPath(); sg.arc(m.x + Math.sin(t * 0.6 + m.p) * 8, yy, m.r, 0, 7); sg.fill();
  });
  // 暗角
  const vg = sg.createRadialGradient(SW / 2, SH * 0.45, SH * 0.3, SW / 2, SH * 0.5, SW * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.42)');
  sg.fillStyle = vg; sg.fillRect(0, 0, SW, SH);
}

  /* ---- 尺寸 / 主循环 ---- */
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    SW = window.innerWidth; SH = window.innerHeight;
    cv.width = SW * dpr; cv.height = SH * dpr;
    cv.style.width = SW + 'px'; cv.style.height = SH + 'px';
    sg.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildScene();
  }
  window.addEventListener('resize', () => { if (cv) resize(); });
  window.addEventListener('mousemove', e => { if (!SW) return; mouse.x = e.clientX / SW; mouse.y = e.clientY / SH; });
  let lastT = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    tSec += dt;
    drawScene(tSec, (mouse.x - 0.5) * 2, (mouse.y - 0.5) * 2);
    raf = requestAnimationFrame(frame);
  }
  return {
    start(canvas) {
      cv = canvas; sg = cv.getContext('2d');
      resize(); drawScene(tSec, 0, 0);
      if (!raf) raf = requestAnimationFrame(frame);
    },
    stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } },
    draw() { if (cv) drawScene(tSec, (mouse.x - 0.5) * 2, (mouse.y - 0.5) * 2); },
  };
})();

