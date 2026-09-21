// heroes.js — 四个英雄的矢量模型绘制（游戏内与落地页共用，零依赖）
// 由 moba.html 抽出：模型函数本身只依赖 ROLES / TEAMCOL / gameTime 与发色渐变缓存，
// 宿主页面（moba.html、index.html）在本文件之后加载内联脚本即可共享这些声明。
// gameTime 由宿主每帧赋值（moba.html 在 update() 里，index.html 在自己的 rAF 里）。

const TEAMCOL = ['#3f8cff', '#ff5252'];

const ROLES = {
  marksman: { cn:'射手', en:'Marksman', face:'🏹', hp:385, hpL:49,  atk:38, atkL:6, atkCd:0.46, range:300, pSpeed:520, move:205, r:15,
    skill:{ name:'穿云箭', en:'Piercing Arrow', cd:8,  ico:'➹', desc:'直线穿透长箭，命中路径上所有敌人',
      dEn:'A long piercing bolt that strikes every enemy in its path' } },
  assassin: { cn:'刺客', en:'Assassin', face:'🗡️', hp:350, hpL:42,  atk:78, atkL:14, atkCd:0.70, range:80, meleeR:75, meleeArc:0.125, pSpeed:560, move:215, r:15,
    skill:{ name:'影袭', en:'Shadow Dash', cd:10, ico:'💫', desc:'向瞄准方向突进，对路径敌人造成伤害并短暂加速',
      dEn:'Dash toward the aim direction, damaging enemies along the path' } },
  tank:     { cn:'肉盾', en:'Tank', face:'🛡️', hp:595, hpL:77,  atk:26, atkL:4, atkCd:0.80, range:105, meleeR:100, pSpeed:420, move:180, r:18,
    skill:{ name:'震地', en:'Seismic Slam', cd:12, ico:'💥', desc:'0.6秒后重击周围大地，伤害并减速敌人',
      dEn:'After 0.6s slam the ground, damaging and slowing nearby enemies' } },
  support:  { cn:'辅助', en:'Support', face:'✚',  hp:434, hpL:55,  atk:30, atkL:5, atkCd:0.60, range:280, pSpeed:480, move:200, r:15,
    skill:{ name:'圣光波', en:'Light Wave', cd:11, ico:'🌟', desc:'放出宽幅光波：伤害敌人、治疗途经的友军',
      dEn:'A wide light wave that damages enemies and heals allies it passes through' } },
};

let gameTime = 0;                          // 动画时钟：由宿主页面每帧推进

// 发色渐变缓存：createLinearGradient 每次命中闪白重绘都会新建对象造成 GC 压力，
// 渐变坐标在填充时才经当前变换解析，缓存后跨调用/跨画布（战斗画面与卡片预览）安全复用。
// 放在角色模型定义之前：登录界面的卡片预览在模型函数定义前就会调用它们。
const _hairGradCache = new Map();
function hairGradOf(g, s, y1) {
  const key = 'm' + (s * 100 | 0) + '|' + y1;
  let byCtx = _hairGradCache.get(g);
  if (!byCtx) { byCtx = {}; _hairGradCache.set(g, byCtx); }
  let hg = byCtx[key];
  if (!hg) {
    hg = g.createLinearGradient(0, -34 * s, 0, y1 * s);
    hg.addColorStop(0, '#eef8fc'); hg.addColorStop(0.5, '#bce4f2'); hg.addColorStop(1, '#7fc6e4');
    byCtx[key] = hg;
  }
  return hg;
}
function pinkHairGradOf(g, s) {                           // 萨勒芬妮粉色渐变发（同样缓存）
  const key = 'pink' + (s * 100 | 0);
  let byCtx = _hairGradCache.get(g);
  if (!byCtx) { byCtx = {}; _hairGradCache.set(g, byCtx); }
  let hg = byCtx[key];
  if (!hg) {
    hg = g.createLinearGradient(0, -34 * s, 0, -8 * s);
    hg.addColorStop(0, '#f2b8d0'); hg.addColorStop(0.5, '#e68fc0'); hg.addColorStop(1, '#d76bb8');
    byCtx[key] = hg;
  }
  return hg;
}

// 两段式肢体 IK：由起点、终点和两段长度求中间关节（肘/膝）
function ikJoint(hx, hy, fx, fy, l1, l2, bend) {
  const dx = fx - hx, dy = fy - hy;
  let d = Math.hypot(dx, dy);
  d = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(d, l1 + l2 - 0.01));
  const ang = Math.atan2(dy, dx);
  const cosA = Math.min(1, Math.max(-1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)));
  const ka = ang + Math.acos(cosA) * bend;
  return [hx + Math.cos(ka) * l1, hy + Math.sin(ka) * l1];
}

// 射手建模 v3（右侧视角矢量，方案 B）：修正头身比（约 3.5 头身）+ 更长高马尾 + 侧脸轮廓 + 护胸金边
// + 侧视步态/举弓拉弦放箭；默认朝右，faceR=-1 时整体镜像；g 参数供选人卡片预览复用
function drawMarksmanModel(c, alpha, g) {
  g = g || ctx;
  const rd = ROLES[c.role], s = rd.r / 15;
  const teamCol = TEAMCOL[c.team];
  const moving = Math.hypot(c.vx, c.vy) > 20;
  const faceR = Math.cos(c.vaim) >= 0 ? 1 : -1;
  const ph = c.walkPhase, T = gameTime;
  const ap = 1 - c.atkCdT / rd.atkCd;

  // 普攻三段（与其他英雄同时序）：-1 拉弦蓄力 → +1 出手挥放 → 0 收招
  let strike = 0;
  if (ap < 0.4) {
    const at = ap / 0.4;
    if (at < 0.3) strike = -at / 0.3;
    else if (at < 0.55) strike = -1 + ((at - 0.3) / 0.25) * 2;
    else strike = 1 - (at - 0.55) / 0.45;
  }
  const mDraw = Math.max(0, -strike);
  const mReleased = strike > 0.5;
  // 抬弓程度帧间平滑：攻击窗口抬起，连续普攻保持举起，停手 0.9s 后缓缓垂下（参照韦鲁斯）
  const raiseTgt = (ap < 0.45 || T - c.lastCombat < 0.9) ? 1 : 0;
  if (c.bowRaise === undefined) c.bowRaise = 0;
  c.bowRaise += (raiseTgt - c.bowRaise) * 0.22;
  const mRaise = c.bowRaise;

  const bob = moving ? Math.abs(Math.sin(ph)) * 1.4 * s : Math.sin(T * 2.2) * 0.7 * s;

  // 配色（参照立绘）+ 勾边与阴影色
  const suit = '#3e3352', suitDk = '#2a2438', gold = '#c9a557', skin = '#7a6b85',
        scarf = '#b23a48', pants = '#35133d', boot = '#2a0a30',
        OUTLINE = 'rgba(26,17,36,0.6)', SHADOW = 'rgba(22,14,32,0.35)';
  const hairGrad = hairGradOf(g, s, -12);                 // 缓存的发色渐变（白色→淡蓝）
  const sway = Math.sin(T * 3.1 + ph * 0.6) * (moving ? 2 : 1.1) * s;   // 马尾/围巾摆动

  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = teamCol; g.lineWidth = 2.2 * s;                   // 队伍识别环（脚下）
  g.globalAlpha = alpha * 0.8;
  g.beginPath(); g.ellipse(0, 1 * s, 11 * s, 4.6 * s, 0, 0, 7); g.stroke();
  g.globalAlpha = alpha;
  if (c.isPlayer) {                                                 // 玩家白圈标识
    g.strokeStyle = '#ffffffcc'; g.lineWidth = 1.3 * s;
    g.beginPath(); g.ellipse(0, 1 * s, 13.5 * s, 5.6 * s, 0, 0, 7); g.stroke();
  }
  // 整体变换：攻击后仰/前倾（世界瞄准轴）+ 跑动倾斜 + 朝向镜像（内部一律朝右绘制）
  g.translate(Math.cos(c.vaim) * strike * 2.5 * s, bob);
  g.rotate(((moving ? 0.06 : 0) + strike * 0.05) * faceR);
  g.scale(faceR, 1);
  const localAim = faceR === 1 ? c.vaim : Math.PI - c.vaim;         // 镜像系内瞄准角
  const mAngL = localAim + (1 - mRaise) * 0.9;                      // 收弓时弓身自然斜向下
  g.lineCap = 'round'; g.lineJoin = 'round';

  // ===== 双腿（侧视步态，与其他英雄同款 ikJoint，原画裤/靴配色）=====
  const hipY = -13 * s;
  const stride = moving ? 6 * s : 0, lift = moving ? 3.5 * s : 0, stance = moving ? 0 : 3 * s;
  const f1 = [Math.sin(ph) * stride - stance, -Math.max(0, Math.cos(ph)) * lift];
  const f2 = [-Math.sin(ph) * stride + stance, -Math.max(0, -Math.cos(ph)) * lift];
  const kk1 = ikJoint(0, hipY, f1[0], f1[1], 6.6 * s, 6.6 * s, -1);
  const kk2 = ikJoint(0, hipY, f2[0], f2[1], 6.6 * s, 6.6 * s, -1);
  [[kk1, f1], [kk2, f2]].forEach(([kk, ff]) => {
    g.strokeStyle = OUTLINE; g.lineWidth = 4 * s;                   // 腿部勾边底稿
    g.beginPath(); g.moveTo(0, hipY); g.lineTo(kk[0], kk[1]); g.lineTo(ff[0], ff[1]); g.stroke();
    g.strokeStyle = pants; g.lineWidth = 3.2 * s;                   // 大腿：原画裤色
    g.beginPath(); g.moveTo(0, hipY); g.lineTo(kk[0], kk[1]); g.stroke();
    g.strokeStyle = boot; g.lineWidth = 3.5 * s;                    // 小腿+长靴
    g.beginPath(); g.moveTo(kk[0], kk[1]); g.lineTo(ff[0], ff[1]); g.stroke();
    g.strokeStyle = SHADOW; g.lineWidth = 1.1 * s;                  // 小腿背光暗边
    g.beginPath(); g.moveTo(kk[0] - 0.9 * s, kk[1] + 0.6 * s); g.lineTo(ff[0] - 0.9 * s, ff[1] + 0.6 * s); g.stroke();
    g.fillStyle = boot;                                            // 靴尖朝前
    g.beginPath(); g.ellipse(ff[0] + 1.3 * s, ff[1] - 0.6 * s, 2.9 * s, 1.9 * s, 0, 0, 7); g.fill();
    g.strokeStyle = gold; g.lineWidth = 0.9 * s;                    // 靴口金线
    g.beginPath(); g.moveTo(kk[0] - 1.5 * s, kk[1] + 0.5 * s); g.lineTo(kk[0] + 1.4 * s, kk[1] - 0.2 * s); g.stroke();
  });

  // ===== 高马尾（修长垂至腰背、随移动飘摆；勾边+内部发丝，画在躯干之后）=====
  g.fillStyle = hairGrad;
  g.beginPath();
  g.moveTo(-1.6 * s, -31.8 * s);
  g.quadraticCurveTo(-6.5 * s - sway, -30 * s, -8 * s - sway, -24.5 * s);
  g.quadraticCurveTo(-9 * s - sway * 0.7, -18.5 * s, -6.4 * s - sway * 0.4, -12.2 * s);
  g.quadraticCurveTo(-4.6 * s - sway * 0.5, -15.5 * s, -3.4 * s, -20 * s);
  g.quadraticCurveTo(-2.2 * s, -27 * s, -1.6 * s, -31.8 * s);
  g.closePath(); g.fill();
  g.strokeStyle = OUTLINE; g.lineWidth = 0.7 * s;                     // 马尾勾边
  g.stroke();
  g.strokeStyle = 'rgba(238,248,252,0.6)'; g.lineWidth = 0.9 * s;     // 内部亮发丝（两束）
  g.beginPath();
  g.moveTo(-3 * s, -30.5 * s);
  g.quadraticCurveTo(-6.8 * s - sway * 0.8, -27.5 * s, -6.6 * s - sway * 0.5, -19 * s);
  g.stroke();
  g.strokeStyle = 'rgba(127,198,228,0.55)'; g.lineWidth = 0.9 * s;
  g.beginPath();
  g.moveTo(-2.2 * s, -30 * s);
  g.quadraticCurveTo(-5 * s - sway * 0.9, -26 * s, -4.4 * s - sway * 0.4, -15 * s);
  g.stroke();
  g.strokeStyle = gold; g.lineWidth = 1.2 * s;                      // 发根金环
  g.beginPath(); g.arc(-2 * s, -31.2 * s, 1.3 * s, 0, 7); g.stroke();

  // ===== 红围巾（颈间束环 + 向后飘的尾带）=====
  g.strokeStyle = scarf; g.lineWidth = 2.6 * s;                     // 颈间围巾环
  g.beginPath(); g.moveTo(0 * s, -23.6 * s); g.lineTo(1.7 * s, -23.1 * s); g.stroke();
  g.fillStyle = scarf;
  g.beginPath();
  g.moveTo(-1.5 * s, -23.5 * s);
  g.quadraticCurveTo(-8 * s - sway * 0.8, -22 * s, -10 * s - sway, -17.5 * s);
  g.quadraticCurveTo(-6 * s - sway * 0.5, -18.5 * s, -1.5 * s, -21.5 * s);
  g.closePath(); g.fill();

  // ===== 躯干（侧视：前胸护板凸出 + 后背弧线 + 勾边/背光阴影/受光高光）=====
  const torsoPath = () => {
    g.beginPath();
    g.moveTo(-3.4 * s, -13.5 * s);                                    // 后腰
    g.quadraticCurveTo(-4.2 * s, -18 * s, -3.6 * s, -22.8 * s);       // 后背
    g.lineTo(-2 * s, -24 * s);                                        // 颈后
    g.lineTo(1.8 * s, -24 * s);                                       // 颈前
    g.quadraticCurveTo(4.8 * s, -20 * s, 3.6 * s, -15.5 * s);         // 前胸（护胸凸出）
    g.quadraticCurveTo(3.4 * s, -14 * s, 3.2 * s, -13.5 * s);         // 前腰
    g.quadraticCurveTo(0, -12.8 * s, -3.4 * s, -13.5 * s);
    g.closePath();
  };
  torsoPath(); g.fillStyle = suit; g.fill();
  g.strokeStyle = OUTLINE; g.lineWidth = 0.7 * s;                     // 躯干勾边
  g.stroke();
  g.save();                                                           // 后背背光阴影（裁剪在躯干内）
  torsoPath(); g.clip();
  g.fillStyle = SHADOW;
  g.beginPath(); g.ellipse(-4.5 * s, -18.5 * s, 3.2 * s, 6 * s, 0, 0, 7); g.fill();
  g.restore();
  g.fillStyle = suitDk;                                             // 护胸板（深色前胸）
  g.beginPath();
  g.moveTo(1.6 * s, -23.6 * s);
  g.quadraticCurveTo(4.6 * s, -20 * s, 3.4 * s, -16.5 * s);
  g.quadraticCurveTo(1.6 * s, -18.5 * s, 0.6 * s, -23.2 * s);
  g.closePath(); g.fill();
  g.strokeStyle = gold; g.lineWidth = 0.9 * s;                      // 护胸金边（前缘，双层）
  g.beginPath(); g.moveTo(1.6 * s, -23.6 * s);
  g.quadraticCurveTo(4.6 * s, -20 * s, 3.4 * s, -16.5 * s); g.stroke();
  g.strokeStyle = 'rgba(201,165,87,0.5)'; g.lineWidth = 0.7 * s;
  g.beginPath(); g.moveTo(1.3 * s, -22.8 * s);
  g.quadraticCurveTo(4 * s, -19.6 * s, 3 * s, -16.8 * s); g.stroke();
  g.fillStyle = gold;                                               // 护胸铆钉
  g.beginPath(); g.arc(2.6 * s, -20.6 * s, 0.6 * s, 0, 7); g.fill();
  g.beginPath(); g.arc(2.2 * s, -18.6 * s, 0.5 * s, 0, 7); g.fill();
  g.fillStyle = '#4a3d63'; g.strokeStyle = gold; g.lineWidth = 0.7 * s;   // 持弓肩小肩甲
  g.beginPath(); g.ellipse(1.1 * s, -23.4 * s, 2.4 * s, 1.8 * s, -0.15, 0, 7); g.fill(); g.stroke();
  g.fillStyle = gold;                                               // 金腰带
  g.fillRect(-3.8 * s, -14.6 * s, 7.4 * s, 1.5 * s);
  g.strokeStyle = teamCol; g.lineWidth = 1.7 * s; g.globalAlpha = alpha * 0.9;   // 队色肩带
  g.beginPath(); g.moveTo(-3 * s, -23.4 * s); g.lineTo(2.4 * s, -15.2 * s); g.stroke();
  g.globalAlpha = alpha;
  g.fillStyle = teamCol;                                            // 队色腰扣
  g.fillRect(-0.9 * s, -15 * s, 1.8 * s, 2.2 * s);

  // ===== 持弓臂（肩→肘→手）+ 荆棘弓（待机垂在身前，攻击绕弓身中心举起转向瞄准）=====
  const ease = mRaise * mRaise * (3 - 2 * mRaise);
  // 弓身（深色那段弓臂）是半径 8 的弧，其中心=弧的中点；手就握在那里
  const rgx = 7.5 * s, rgy = -14.5 * s;                             // 待机弧心（垂弓在身前）
  const ugx = Math.cos(localAim) * 8 * s, ugy = -20 * s + Math.sin(localAim) * 6 * s;
  const gx = rgx + (ugx - rgx) * ease, gy = rgy + (ugy - rgy) * ease;   // 弧心（弓的曲率中心，不是手握点）
  const hx = gx + Math.cos(mAngL) * 8 * s, hy = gy + Math.sin(mAngL) * 8 * s;   // 手握点=弓身弧的中点
  const shX = 1.2 * s, shY = -22.8 * s;                             // 持弓肩（前肩）
  const elB = ikJoint(shX, shY, hx, hy, 7.2 * s, 7.2 * s, 1);       // 肘部朝下
  g.strokeStyle = OUTLINE; g.lineWidth = 3.5 * s;                   // 手臂勾边底稿
  g.beginPath(); g.moveTo(shX, shY); g.lineTo(elB[0], elB[1]); g.lineTo(hx, hy); g.stroke();
  g.strokeStyle = skin; g.lineWidth = 2.8 * s;
  g.beginPath(); g.moveTo(shX, shY); g.lineTo(elB[0], elB[1]); g.lineTo(hx, hy); g.stroke();
  g.strokeStyle = gold; g.lineWidth = 3 * s;                        // 前臂金护腕
  g.beginPath();
  g.moveTo(elB[0] + (hx - elB[0]) * 0.5, elB[1] + (hy - elB[1]) * 0.5);
  g.lineTo(elB[0] + (hx - elB[0]) * 0.92, elB[1] + (hy - elB[1]) * 0.92);
  g.stroke();

  // 弦尾拉距：弓一举起来弦就后移 4（左手扣在弦上、与握弓的右手完全分开），拉满共后移 9
  const nock = -(4 + mDraw * 5) * s;                             // 与左臂手指位置严格一致
  g.save(); g.translate(gx, gy); g.rotate(mAngL);
  g.strokeStyle = 'rgba(201,58,110,0.35)'; g.lineWidth = 1.2 * s;  // 弓身魔纹微光
  g.beginPath(); g.arc(0, 0, 6.6 * s, -1.05, 1.05); g.stroke();
  g.strokeStyle = '#5a3c4e'; g.lineWidth = 2.8 * s;                // 荆棘木弓臂
  g.beginPath(); g.arc(0, 0, 8 * s, -1.1, 1.1); g.stroke();
  g.fillStyle = '#6f4d68';                                         // 外缘荆棘刺
  [-0.55, 0, 0.55].forEach(t => {
    const bxp = Math.cos(t) * 8 * s, byp = Math.sin(t) * 8 * s;
    const txp = Math.cos(t + 0.16) * 11.6 * s, typ = Math.sin(t + 0.16) * 11.6 * s;
    g.beginPath();
    g.moveTo(bxp - Math.sin(t) * 1.1 * s, byp + Math.cos(t) * 1.1 * s);
    g.lineTo(txp, typ);
    g.lineTo(bxp + Math.sin(t) * 1.1 * s, byp - Math.cos(t) * 1.1 * s);
    g.closePath(); g.fill();
  });
  g.fillStyle = gold;                                              // 金色弓梢
  g.beginPath(); g.arc(Math.cos(-1.1) * 8 * s, Math.sin(-1.1) * 8 * s, 1.4 * s, 0, 7); g.fill();
  g.beginPath(); g.arc(Math.cos(1.1) * 8 * s, Math.sin(1.1) * 8 * s, 1.4 * s, 0, 7); g.fill();
  g.fillStyle = skin;                                              // 握弓拳心：局部 (8,0) 即弓身弧的中点，盖住弓身表示握持
  g.beginPath(); g.arc(8 * s, 0, 1.7 * s, 0, 7); g.fill();
  g.strokeStyle = '#9aa3b5'; g.lineWidth = 1 * s;                  // 弓弦（画在拳心上层，不被手遮挡）
  g.beginPath();
  g.moveTo(Math.cos(-1.1) * 8 * s, Math.sin(-1.1) * 8 * s);
  g.lineTo(nock, 0);
  g.lineTo(Math.cos(1.1) * 8 * s, Math.sin(1.1) * 8 * s);
  g.stroke();
  if (!mReleased) {                                                // 弦上的青色箭（拉越满越亮）
    g.save(); g.shadowColor = '#4dd0e1'; g.shadowBlur = 4 + mDraw * 12;
    g.strokeStyle = '#4dd0e1'; g.lineWidth = 2 * s;
    g.beginPath(); g.moveTo(nock, 0); g.lineTo(nock + 13 * s, 0); g.stroke();
    g.fillStyle = '#b2ebf2';
    g.beginPath(); g.moveTo(nock + 17 * s, 0); g.lineTo(nock + 11 * s, -3 * s); g.lineTo(nock + 11 * s, 3 * s); g.closePath(); g.fill();
    g.restore();
  } else {                                                         // 放箭瞬间：弦弹回的白闪
    g.strokeStyle = 'rgba(178,235,242,0.9)'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(-2 * s, 0); g.lineTo(12 * s, 0); g.stroke();
  }
  g.restore();

  // ===== 左臂：弓举起时扣住弦尾（与握弓的右手分开）；弓放下时自然垂在体侧 =====
  if (mRaise > 0.15) {
    const dirx = Math.cos(mAngL), diry = Math.sin(mAngL);
    const back = (4 + mDraw * 5) * s;                     // 与弦尾一致：举起即 4，拉满 9
    const nkx = gx - dirx * back, nky = gy - diry * back;
    const elO = ikJoint(-2.6 * s, -24.6 * s, nkx, nky, 6.2 * s, 6.2 * s, 1);
    g.strokeStyle = skin; g.lineWidth = 2.6 * s;
    g.beginPath(); g.moveTo(-2.6 * s, -24.6 * s); g.lineTo(elO[0], elO[1]); g.lineTo(nkx, nky); g.stroke();
    g.fillStyle = skin;
    g.beginPath(); g.arc(nkx, nky, 1.4 * s, 0, 7); g.fill();
  } else {                                                // 弓垂下：左臂自然垂在体侧
    const lx = -3.8 * s, ly = -10.6 * s;
    const elO = ikJoint(-2.6 * s, -22.8 * s, lx, ly, 6.2 * s, 6.2 * s, 1);
    g.strokeStyle = skin; g.lineWidth = 2.6 * s;
    g.beginPath(); g.moveTo(-2.6 * s, -22.8 * s); g.lineTo(elO[0], elO[1]); g.lineTo(lx, ly); g.stroke();
    g.fillStyle = skin;
    g.beginPath(); g.arc(lx, ly, 1.4 * s, 0, 7); g.fill();
  }

  // ===== 头（侧脸朝右，约 3.5 头身；勾边 + 后侧受光阴影 + 眉弓 + 延伸面纹）=====
  g.strokeStyle = skin; g.lineWidth = 1.4 * s;                      // 颈
  g.beginPath(); g.moveTo(-0.2 * s, -23.5 * s); g.lineTo(0.4 * s, -25.2 * s); g.stroke();
  g.fillStyle = skin;
  g.beginPath(); g.ellipse(0.8 * s, -28.8 * s, 4.3 * s, 5 * s, -0.06, 0, 7); g.fill();
  g.save();                                                         // 头后侧阴影（裁剪在头型内）
  g.beginPath(); g.ellipse(0.8 * s, -28.8 * s, 4.3 * s, 5 * s, -0.06, 0, 7); g.clip();
  g.fillStyle = 'rgba(102,88,115,0.4)';
  g.beginPath(); g.ellipse(-1.2 * s, -28.4 * s, 3.6 * s, 5.2 * s, -0.06, 0, 7); g.fill();
  g.restore();
  g.strokeStyle = OUTLINE; g.lineWidth = 0.7 * s;                   // 头部勾边
  g.beginPath(); g.ellipse(0.8 * s, -28.8 * s, 4.3 * s, 5 * s, -0.06, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(4.6 * s, -28.9 * s); g.lineTo(6.1 * s, -28 * s); g.lineTo(4.6 * s, -27.3 * s); g.closePath(); g.fill();  // 鼻
  g.strokeStyle = '#6a5c77'; g.lineWidth = 0.9 * s;                 // 耳
  g.beginPath(); g.arc(-1.6 * s, -28.6 * s, 1.1 * s, 0, 7); g.stroke();
  g.strokeStyle = '#5d5069'; g.lineWidth = 0.9 * s;                 // 眉弓
  g.beginPath(); g.moveTo(1.9 * s, -30.6 * s); g.lineTo(3.6 * s, -30.4 * s); g.stroke();
  g.save();                                                         // 发光独眼
  g.shadowColor = '#f2f5f7'; g.shadowBlur = 3 * s;
  g.fillStyle = '#f2f5f7';
  g.beginPath(); g.arc(2.7 * s, -29.3 * s, 1 * s, 0, 7); g.fill();
  g.restore();
  g.strokeStyle = '#c93a6e'; g.lineWidth = 0.9 * s;                 // 洋红面纹（眼下向后延伸至颌）
  g.beginPath(); g.moveTo(2.2 * s, -27.7 * s);
  g.quadraticCurveTo(0.4 * s, -27 * s, -1.4 * s, -27.8 * s); g.stroke();
  g.beginPath(); g.moveTo(1.9 * s, -26.9 * s);
  g.quadraticCurveTo(0.8 * s, -26.3 * s, -0.4 * s, -26.8 * s); g.stroke();

  // 头发：后脑盖 + 额前刘海（白→蓝渐变 + 勾边 + 顶部高光发丝；高马尾已画在躯干之后）
  g.fillStyle = hairGrad;
  g.beginPath();
  g.moveTo(4.4 * s, -29.6 * s);                                     // 额前发际
  g.quadraticCurveTo(3.4 * s, -33.6 * s, -0.6 * s, -33.8 * s);      // 头顶
  g.quadraticCurveTo(-4.6 * s, -33.4 * s, -4.2 * s, -28.4 * s);     // 后脑
  g.quadraticCurveTo(-2.4 * s, -26.2 * s, 0.2 * s, -26.6 * s);      // 后颈发脚
  g.quadraticCurveTo(2.2 * s, -27.4 * s, 3 * s, -28.2 * s);         // 鬓角
  g.closePath(); g.fill();
  g.strokeStyle = OUTLINE; g.lineWidth = 0.7 * s;                   // 发盖勾边
  g.stroke();
  g.strokeStyle = 'rgba(238,248,252,0.65)'; g.lineWidth = 0.8 * s;  // 头顶高光发丝
  g.beginPath(); g.moveTo(3.2 * s, -31.6 * s);
  g.quadraticCurveTo(1 * s, -33.2 * s, -1.6 * s, -32.6 * s); g.stroke();
  g.strokeStyle = 'rgba(127,198,228,0.5)';
  g.beginPath(); g.moveTo(-2.8 * s, -31.8 * s);
  g.quadraticCurveTo(-4 * s, -30.4 * s, -3.8 * s, -28.8 * s); g.stroke();
  g.beginPath();                                                    // 额前刘海束
  g.moveTo(4.4 * s, -29.6 * s); g.quadraticCurveTo(4.9 * s, -27.6 * s, 3.8 * s, -26.8 * s);
  g.quadraticCurveTo(3.2 * s, -28.4 * s, 3 * s, -29.4 * s);
  g.closePath(); g.fill();

  g.restore();
  g.globalAlpha = 1;
}

// 刺客建模 v3（右侧视角矢量，参照亚索立绘）：修正头身比（约 3.5 头身）+ 武士高发髻 + 和风外套白束带
// + 护臂板甲 + 腰间刀鞘 + 武士刀三段挥砍（蓄力后摆→前挥→收势）；默认朝右，faceR=-1 时整体镜像
function drawAssassinModel(c, alpha, g) {
  g = g || ctx;
  const rd = ROLES[c.role], s = rd.r / 15;
  const teamCol = TEAMCOL[c.team];
  const moving = Math.hypot(c.vx, c.vy) > 20;
  const faceR = Math.cos(c.vaim) >= 0 ? 1 : -1;
  const ph = c.walkPhase, T = gameTime;
  const ap = 1 - c.atkCdT / rd.atkCd;

  // 普攻三段（与其他英雄同时序）：-1 蓄力后摆 → +1 挥出 → 0 收势
  let strike = 0;
  if (ap < 0.4) {
    const at = ap / 0.4;
    if (at < 0.3) strike = -at / 0.3;
    else if (at < 0.55) strike = -1 + ((at - 0.3) / 0.25) * 2;
    else strike = 1 - (at - 0.55) / 0.45;
  }

  const bob = moving ? Math.abs(Math.sin(ph)) * 1.4 * s : Math.sin(T * 2.2) * 0.7 * s;

  // 配色（参照亚索立绘）+ 勾边与阴影色
  const jacket = '#54738b', jacketDk = '#2a3d52', undershirt = '#c4b2c0',
        sash = '#e8e4dc', skin = '#d8a87a', skinDk = '#b9895e',
        scarf = '#e58a74', scarfDk = '#c96f5c', hair = '#241722', hairLt = '#452a44',
        pants = '#416c8f', boot = '#394573', bracer = '#2b3242', bracerEdge = '#8a94a8',
        blade = '#cdd6e0', sheathC = '#1e1a26', tsuba = '#b78f4e',
        OUTLINE = 'rgba(18,14,24,0.6)', SHADOW = 'rgba(16,12,22,0.3)';
  const sway = Math.sin(T * 3.1 + ph * 0.6) * (moving ? 2 : 1.1) * s;   // 围巾/发髻飘带摆动

  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = teamCol; g.lineWidth = 2.2 * s;                   // 队伍识别环（脚下）
  g.globalAlpha = alpha * 0.8;
  g.beginPath(); g.ellipse(0, 1 * s, 11 * s, 4.6 * s, 0, 0, 7); g.stroke();
  g.globalAlpha = alpha;
  if (c.isPlayer) {                                                 // 玩家白圈标识
    g.strokeStyle = '#ffffffcc'; g.lineWidth = 1.3 * s;
    g.beginPath(); g.ellipse(0, 1 * s, 13.5 * s, 5.6 * s, 0, 0, 7); g.stroke();
  }
  // 整体变换：蓄力后仰/挥出前倾（世界瞄准轴）+ 跑动倾斜 + 朝向镜像（内部一律朝右绘制）
  g.translate(Math.cos(c.vaim) * strike * 2.5 * s, bob);
  g.rotate(((moving ? 0.06 : 0) + strike * 0.06) * faceR);
  g.scale(faceR, 1);
  const localAim = faceR === 1 ? c.vaim : Math.PI - c.vaim;         // 镜像系内瞄准角
  g.lineCap = 'round'; g.lineJoin = 'round';

  // ===== 双腿（侧视步态，与其他英雄同款 ikJoint，原画裤/靴配色）=====
  const hipY = -13 * s;
  const stride = moving ? 6 * s : 0, lift = moving ? 3.5 * s : 0, stance = moving ? 0 : 3 * s;
  const f1 = [Math.sin(ph) * stride - stance, -Math.max(0, Math.cos(ph)) * lift];
  const f2 = [-Math.sin(ph) * stride + stance, -Math.max(0, -Math.cos(ph)) * lift];
  const kk1 = ikJoint(0, hipY, f1[0], f1[1], 6.6 * s, 6.6 * s, -1);
  const kk2 = ikJoint(0, hipY, f2[0], f2[1], 6.6 * s, 6.6 * s, -1);
  [[kk1, f1], [kk2, f2]].forEach(([kk, ff]) => {
    g.strokeStyle = OUTLINE; g.lineWidth = 4 * s;                   // 腿部勾边底稿
    g.beginPath(); g.moveTo(0, hipY); g.lineTo(kk[0], kk[1]); g.lineTo(ff[0], ff[1]); g.stroke();
    g.strokeStyle = pants; g.lineWidth = 3.2 * s;                   // 大腿：原画裤色
    g.beginPath(); g.moveTo(0, hipY); g.lineTo(kk[0], kk[1]); g.stroke();
    g.strokeStyle = 'rgba(133,166,196,0.45)'; g.lineWidth = 0.9 * s;  // 大腿受光亮边
    g.beginPath(); g.moveTo(-0.4 * s, hipY + 1 * s); g.lineTo(kk[0] - 0.4 * s, kk[1] - 1 * s); g.stroke();
    g.strokeStyle = boot; g.lineWidth = 3.5 * s;                    // 小腿+长靴
    g.beginPath(); g.moveTo(kk[0], kk[1]); g.lineTo(ff[0], ff[1]); g.stroke();
    g.strokeStyle = SHADOW; g.lineWidth = 1.1 * s;                  // 小腿背光暗边
    g.beginPath(); g.moveTo(kk[0] - 0.9 * s, kk[1] + 0.6 * s); g.lineTo(ff[0] - 0.9 * s, ff[1] + 0.6 * s); g.stroke();
    g.fillStyle = boot;                                            // 靴尖朝前
    g.beginPath(); g.ellipse(ff[0] + 1.3 * s, ff[1] - 0.6 * s, 2.9 * s, 1.9 * s, 0, 0, 7); g.fill();
  });

  // ===== 腰间刀鞘（斜背于髋后：鞘口绑绳 + 金鞘尾帽）=====
  g.strokeStyle = sheathC; g.lineWidth = 2.4 * s;
  g.beginPath(); g.moveTo(-1.8 * s, -14 * s); g.lineTo(-7.2 * s, -19 * s); g.stroke();
  g.strokeStyle = OUTLINE; g.lineWidth = 0.6 * s;                   // 鞘口
  g.beginPath(); g.moveTo(-2 * s, -13.4 * s); g.lineTo(-1.4 * s, -14.8 * s); g.stroke();
  g.strokeStyle = tsuba; g.lineWidth = 0.7 * s;                     // 鞘身绑绳×2
  g.beginPath(); g.moveTo(-3.1 * s, -15.6 * s); g.lineTo(-2.3 * s, -14.7 * s); g.stroke();
  g.beginPath(); g.moveTo(-4.6 * s, -16.8 * s); g.lineTo(-3.8 * s, -15.9 * s); g.stroke();
  g.strokeStyle = bracerEdge; g.lineWidth = 0.8 * s;                // 鞘身受光亮线
  g.beginPath(); g.moveTo(-2.6 * s, -14.6 * s); g.lineTo(-6.6 * s, -18.4 * s); g.stroke();

  // ===== 鲑红围巾（颈间束环 + 向后飘的尾带）=====
  g.strokeStyle = scarf; g.lineWidth = 2.4 * s;
  g.beginPath(); g.moveTo(-0.2 * s, -23.6 * s); g.lineTo(1.5 * s, -23.1 * s); g.stroke();
  g.fillStyle = scarf;
  g.beginPath();
  g.moveTo(-1.5 * s, -23.5 * s);
  g.quadraticCurveTo(-7.5 * s - sway * 0.8, -22.5 * s, -9.5 * s - sway, -18.5 * s);
  g.quadraticCurveTo(-5.5 * s - sway * 0.5, -19 * s, -1.5 * s, -21.5 * s);
  g.closePath(); g.fill();
  g.strokeStyle = scarfDk; g.lineWidth = 0.7 * s;                   // 尾带暗纹
  g.beginPath(); g.moveTo(-3.5 * s, -22.4 * s);
  g.quadraticCurveTo(-7 * s - sway * 0.7, -21.8 * s, -8.4 * s - sway * 0.9, -19.2 * s); g.stroke();

  // ===== 躯干（和风外套：前襟斜开 + 白色宽束带 + 背光阴影/勾边）=====
  const torsoPath = () => {
    g.beginPath();
    g.moveTo(-3.6 * s, -13.6 * s);                                   // 后腰
    g.quadraticCurveTo(-4.4 * s, -18 * s, -3.6 * s, -22.8 * s);      // 后背
    g.lineTo(-2 * s, -24 * s);                                       // 颈后
    g.lineTo(1.8 * s, -24 * s);                                      // 颈前
    g.quadraticCurveTo(5 * s, -19.5 * s, 3.8 * s, -15.5 * s);        // 前胸
    g.quadraticCurveTo(3.6 * s, -14 * s, 3.4 * s, -13.6 * s);        // 前腰
    g.quadraticCurveTo(0, -12.9 * s, -3.6 * s, -13.6 * s);
    g.closePath();
  };
  torsoPath(); g.fillStyle = jacket; g.fill();
  g.strokeStyle = OUTLINE; g.lineWidth = 0.7 * s;                    // 躯干勾边
  g.stroke();
  g.save();                                                          // 后背背光阴影
  torsoPath(); g.clip();
  g.fillStyle = SHADOW;
  g.beginPath(); g.ellipse(-4.8 * s, -18.5 * s, 3.2 * s, 6 * s, 0, 0, 7); g.fill();
  g.restore();
  g.fillStyle = undershirt;                                          // 前襟内衬（斜开领口）
  g.beginPath();
  g.moveTo(1.4 * s, -23.8 * s);
  g.quadraticCurveTo(2.8 * s, -20 * s, 2.6 * s, -16.8 * s);
  g.quadraticCurveTo(1.4 * s, -18 * s, 0.5 * s, -23.4 * s);
  g.closePath(); g.fill();
  g.strokeStyle = jacketDk; g.lineWidth = 1 * s;                     // 前襟缝线
  g.beginPath(); g.moveTo(1.4 * s, -23.8 * s); g.quadraticCurveTo(3.1 * s, -19.8 * s, 2.7 * s, -16.6 * s); g.stroke();
  g.strokeStyle = 'rgba(140,175,205,0.55)'; g.lineWidth = 1 * s;    // 前胸受光亮边
  g.beginPath(); g.moveTo(1.9 * s, -23.6 * s); g.quadraticCurveTo(5.1 * s, -19.4 * s, 3.9 * s, -15.6 * s); g.stroke();
  g.strokeStyle = 'rgba(30,45,66,0.35)'; g.lineWidth = 0.6 * s;     // 外套褶皱两道
  g.beginPath(); g.moveTo(-1.6 * s, -17.5 * s); g.quadraticCurveTo(-1.2 * s, -16 * s, -1.8 * s, -14.9 * s); g.stroke();
  g.beginPath(); g.moveTo(0.6 * s, -17.8 * s); g.quadraticCurveTo(0.9 * s, -16.2 * s, 0.4 * s, -15 * s); g.stroke();
  g.fillStyle = sash;                                                // 白色宽束带
  g.fillRect(-4 * s, -14.9 * s, 7.7 * s, 1.8 * s);
  g.strokeStyle = 'rgba(120,110,100,0.4)'; g.lineWidth = 0.5 * s;   // 束带纹理线
  g.beginPath(); g.moveTo(-3.6 * s, -14.1 * s); g.lineTo(3.4 * s, -14.1 * s); g.stroke();
  g.fillStyle = teamCol;                                             // 队色腰扣
  g.fillRect(-0.9 * s, -15.2 * s, 1.8 * s, 2.4 * s);
  g.strokeStyle = sash; g.lineWidth = 1.3 * s;                       // 束带垂穗（髋侧飘）
  g.beginPath(); g.moveTo(-3.2 * s, -13.6 * s);
  g.quadraticCurveTo(-4.4 * s - sway * 0.4, -12 * s, -4 * s - sway * 0.7, -10.6 * s); g.stroke();

  // ===== 持刀臂（肩→肘→手）+ 武士刀（三段挥砍：蓄力后摆→前挥→收势）=====
  const handAng = localAim + 1.5 - strike * 1.7;                     // 手臂连挥扫过身前
  const reach = 6 + Math.abs(strike) * 2;
  const hx2 = 1.2 * s + Math.cos(handAng) * reach * s;
  const hy2 = -22.8 * s + Math.sin(handAng) * reach * s * 0.85;
  const el2 = ikJoint(1.2 * s, -22.8 * s, hx2, hy2, 6.2 * s, 6.2 * s, -1);
  g.strokeStyle = OUTLINE; g.lineWidth = 3.5 * s;                    // 手臂勾边底稿
  g.beginPath(); g.moveTo(1.2 * s, -22.8 * s); g.lineTo(el2[0], el2[1]); g.lineTo(hx2, hy2); g.stroke();
  g.strokeStyle = skin; g.lineWidth = 2.8 * s;
  g.beginPath(); g.moveTo(1.2 * s, -22.8 * s); g.lineTo(el2[0], el2[1]); g.lineTo(hx2, hy2); g.stroke();
  g.strokeStyle = bracer; g.lineWidth = 3.2 * s;                     // 前臂板甲护臂
  g.beginPath();
  g.moveTo(el2[0] + (hx2 - el2[0]) * 0.35, el2[1] + (hy2 - el2[1]) * 0.35);
  g.lineTo(el2[0] + (hx2 - el2[0]) * 0.88, el2[1] + (hy2 - el2[1]) * 0.88);
  g.stroke();
  g.strokeStyle = bracerEdge; g.lineWidth = 0.7 * s;                 // 护臂亮边
  g.beginPath();
  g.moveTo(el2[0] + (hx2 - el2[0]) * 0.4, el2[1] + (hy2 - el2[1]) * 0.4 - 1.2 * s);
  g.lineTo(el2[0] + (hx2 - el2[0]) * 0.85, el2[1] + (hy2 - el2[1]) * 0.85 - 1.2 * s);
  g.stroke();

  // 武士刀：刀柄（手后）→ 圆形刀锷 → 刀身（浅色刃 + 白刃口）
  const bladeAng = handAng + 0.3;
  const bxv = Math.cos(bladeAng), byv = Math.sin(bladeAng);
  g.strokeStyle = '#3a2f28'; g.lineWidth = 2 * s;                    // 刀柄
  g.beginPath(); g.moveTo(hx2 - bxv * 2.8 * s, hy2 - byv * 2.8 * s); g.lineTo(hx2, hy2); g.stroke();
  g.fillStyle = tsuba;                                               // 圆形刀锷
  g.beginPath(); g.arc(hx2 + bxv * 0.6 * s, hy2 + byv * 0.6 * s, 1.5 * s, 0, 7); g.fill();
  g.strokeStyle = OUTLINE; g.lineWidth = 0.8 * s;                    // 刀身勾边底稿
  g.beginPath(); g.moveTo(hx2, hy2); g.lineTo(hx2 + bxv * 11.5 * s, hy2 + byv * 11.5 * s); g.stroke();
  g.strokeStyle = blade; g.lineWidth = 1.8 * s;                      // 刀身
  g.beginPath(); g.moveTo(hx2 + bxv * 0.8 * s, hy2 + byv * 0.8 * s); g.lineTo(hx2 + bxv * 11.5 * s, hy2 + byv * 11.5 * s); g.stroke();
  g.strokeStyle = '#f2f6fa'; g.lineWidth = 0.6 * s;                  // 刃口高光
  g.beginPath(); g.moveTo(hx2 + bxv * 2 * s, hy2 + byv * 2 * s - 0.7 * s); g.lineTo(hx2 + bxv * 10.8 * s, hy2 + byv * 10.8 * s - 0.7 * s); g.stroke();
  g.strokeStyle = 'rgba(240,246,250,0.4)'; g.lineWidth = 0.5 * s;    // 刃纹（沸线）
  g.beginPath(); g.moveTo(hx2 + bxv * 3.5 * s, hy2 + byv * 3.5 * s + 0.3 * s);
  g.quadraticCurveTo(hx2 + bxv * 7 * s, hy2 + byv * 7 * s - 0.2 * s, hx2 + bxv * 10 * s, hy2 + byv * 10 * s + 0.3 * s); g.stroke();
  if (strike > 0.35) {                                               // 挥砍拖影
    g.strokeStyle = 'rgba(227,232,242,0.5)'; g.lineWidth = 3 * s;
    const a0 = bladeAng - 1.5 * strike;
    g.beginPath();
    g.arc(1.2 * s, -22.8 * s, reach * s + 4 * s, a0 - 0.5, bladeAng + 0.15); g.stroke();
  }
  g.fillStyle = skin;                                                // 握刀拳心
  g.beginPath(); g.arc(hx2, hy2, 1.8 * s, 0, 7); g.fill();

  // ===== 左臂（原缺失：自然垂在体侧，与持刀臂同色，肘部贴身不外翻）=====
  const lArmY = -10.6 * s;
  const elL = ikJoint(-2.6 * s, -22.8 * s, -3.8 * s, lArmY, 6.2 * s, 6.2 * s, 1);
  g.strokeStyle = OUTLINE; g.lineWidth = 3.4 * s;                      // 勾边底稿
  g.beginPath(); g.moveTo(-2.6 * s, -22.8 * s); g.lineTo(elL[0], elL[1]); g.lineTo(-3.8 * s, lArmY); g.stroke();
  g.strokeStyle = skin; g.lineWidth = 2.7 * s;                         // 与右臂同色
  g.beginPath(); g.moveTo(-2.6 * s, -22.8 * s); g.lineTo(elL[0], elL[1]); g.lineTo(-3.8 * s, lArmY); g.stroke();
  g.fillStyle = skin;                                                  // 拳心
  g.beginPath(); g.arc(-3.8 * s, lArmY, 1.6 * s, 0, 7); g.fill();

  // ===== 头（侧脸朝右，约 3.5 头身：武士髻 + 长鬓角 + 短须 + 后侧阴影）=====
  g.strokeStyle = skin; g.lineWidth = 1.4 * s;                       // 颈
  g.beginPath(); g.moveTo(-0.2 * s, -23.5 * s); g.lineTo(0.4 * s, -25.2 * s); g.stroke();
  g.fillStyle = skin;
  g.beginPath(); g.ellipse(0.8 * s, -28.8 * s, 4.2 * s, 4.9 * s, -0.06, 0, 7); g.fill();
  g.save();                                                          // 头后侧阴影
  g.beginPath(); g.ellipse(0.8 * s, -28.8 * s, 4.2 * s, 4.9 * s, -0.06, 0, 7); g.clip();
  g.fillStyle = 'rgba(150,105,70,0.35)';
  g.beginPath(); g.ellipse(-1.2 * s, -28.4 * s, 3.5 * s, 5.1 * s, -0.06, 0, 7); g.fill();
  g.restore();
  g.strokeStyle = OUTLINE; g.lineWidth = 0.7 * s;                    // 头部勾边
  g.beginPath(); g.ellipse(0.8 * s, -28.8 * s, 4.2 * s, 4.9 * s, -0.06, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(4.5 * s, -29 * s); g.lineTo(5.9 * s, -28.2 * s); g.lineTo(4.5 * s, -27.4 * s); g.closePath(); g.fill();  // 鼻
  g.strokeStyle = '#3a2c22'; g.lineWidth = 0.8 * s;                  // 短须（下颌）
  g.beginPath(); g.moveTo(3.4 * s, -25.4 * s); g.quadraticCurveTo(4.2 * s, -25 * s, 4.8 * s, -25.6 * s); g.stroke();
  g.strokeStyle = '#3a2c22'; g.lineWidth = 0.9 * s;                  // 眉弓
  g.beginPath(); g.moveTo(2 * s, -30.4 * s); g.lineTo(3.7 * s, -30.2 * s); g.stroke();
  g.fillStyle = '#2a2018';                                           // 眼
  g.beginPath(); g.ellipse(2.8 * s, -29.2 * s, 0.8 * s, 0.55 * s, 0, 0, 7); g.fill();
  g.strokeStyle = '#3a2c22'; g.lineWidth = 0.8 * s;                  // 耳
  g.beginPath(); g.arc(-1.5 * s, -28.7 * s, 1 * s, 0, 7); g.stroke();

  // 头发：黑发盖 + 前额碎发 + 长鬓角 + 武士高发髻
  g.fillStyle = hair;
  g.beginPath();
  g.moveTo(4.3 * s, -29.8 * s);                                      // 前额发际
  g.quadraticCurveTo(3.6 * s, -33.4 * s, -0.5 * s, -33.5 * s);       // 头顶
  g.quadraticCurveTo(-4.3 * s, -33.2 * s, -3.9 * s, -28.6 * s);      // 后脑
  g.quadraticCurveTo(-2.6 * s, -26.4 * s, 0.2 * s, -26.8 * s);       // 后颈发脚
  g.quadraticCurveTo(2 * s, -27.4 * s, 2.6 * s, -28.3 * s);          // 鬓角上
  g.closePath(); g.fill();
  g.strokeStyle = OUTLINE; g.lineWidth = 0.7 * s;                    // 发盖勾边
  g.stroke();
  g.strokeStyle = hairLt; g.lineWidth = 0.8 * s;                     // 发顶高光
  g.beginPath(); g.moveTo(2.8 * s, -31.6 * s); g.quadraticCurveTo(0.6 * s, -33 * s, -1.8 * s, -32.4 * s); g.stroke();
  g.strokeStyle = hair; g.lineWidth = 1.1 * s;                       // 前额碎发两束
  g.beginPath(); g.moveTo(3.9 * s, -31 * s); g.lineTo(4.4 * s, -29.6 * s); g.stroke();
  g.beginPath(); g.moveTo(2.8 * s, -32 * s); g.lineTo(3.5 * s, -30.6 * s); g.stroke();
  g.strokeStyle = hair; g.lineWidth = 1 * s;                         // 长鬓角（耳前至下颌）
  g.beginPath(); g.moveTo(1.6 * s, -28.4 * s); g.quadraticCurveTo(2.4 * s, -27 * s, 2.9 * s, -25.6 * s); g.stroke();
  g.fillStyle = hair;                                                // 武士高发髻 + 发绳
  g.beginPath(); g.ellipse(-1.6 * s, -34.4 * s, 1.7 * s, 1.9 * s, 0.3, 0, 7); g.fill();
  g.strokeStyle = OUTLINE; g.lineWidth = 0.5 * s;                    // 发髻勾边
  g.stroke();
  g.strokeStyle = hairLt; g.lineWidth = 0.6 * s;
  g.beginPath(); g.arc(-1.6 * s, -34.4 * s, 1.1 * s, 0.5, 2.6); g.stroke();
  g.strokeStyle = hairLt; g.lineWidth = 0.5 * s;                     // 发髻束发纹两道
  g.beginPath(); g.moveTo(-2.2 * s, -34.9 * s); g.lineTo(-1 * s, -34.2 * s); g.stroke();
  g.beginPath(); g.moveTo(-2 * s, -33.9 * s); g.lineTo(-0.9 * s, -33.3 * s); g.stroke();
  g.strokeStyle = tsuba; g.lineWidth = 0.8 * s;                      // 发绳
  g.beginPath(); g.moveTo(-2.9 * s, -33.2 * s); g.lineTo(-0.5 * s, -33.6 * s); g.stroke();
  g.strokeStyle = tsuba; g.lineWidth = 0.6 * s;                      // 发绳飘尾
  g.beginPath(); g.moveTo(-0.7 * s, -33.5 * s); g.quadraticCurveTo(0.2 * s + sway * 0.3, -32.9 * s, 0.6 * s + sway * 0.5, -32.2 * s); g.stroke();

  g.restore();
  g.globalAlpha = 1;
}

// 肉盾建模 v3（右侧视角矢量，参照布隆立绘）：约 3 头身的魁梧体格 + 光顶短发 + 橙色大胡须
// + 赤膊胸肌 + 皮草肩带 + 门板巨盾冲撞（蓄力收盾→前顶盾击）；默认朝右，faceR=-1 时整体镜像
function drawTankModel(c, alpha, g) {
  g = g || ctx;
  const rd = ROLES[c.role], s = rd.r / 15;                          // 肉盾 r=18 → s=1.2 自带大体型
  const teamCol = TEAMCOL[c.team];
  const moving = Math.hypot(c.vx, c.vy) > 20;
  const faceR = Math.cos(c.vaim) >= 0 ? 1 : -1;
  const ph = c.walkPhase, T = gameTime;
  const ap = 1 - c.atkCdT / rd.atkCd;

  let strike = 0;                                                   // 三段：-1 收盾蓄力 → +1 前顶盾击 → 0 收势
  if (ap < 0.4) {
    const at = ap / 0.4;
    if (at < 0.3) strike = -at / 0.3;
    else if (at < 0.55) strike = -1 + ((at - 0.3) / 0.25) * 2;
    else strike = 1 - (at - 0.55) / 0.45;
  }

  const bob = moving ? Math.abs(Math.sin(ph)) * 1.6 * s : Math.sin(T * 2) * 0.7 * s;

  // 配色（参照布隆立绘）
  const skin = '#c98d63', skinDk = '#a06b48', beard = '#d9822b', beardDk = '#a85a1d',
        hair = '#3a2a22', pants = '#274d7c', pantsDk = '#152035', boot = '#2f3978',
        leather = '#4a3a2e', gold = '#c9a557', door = '#4e6a8c', doorDk = '#31465e',
        OUTLINE = 'rgba(18,14,24,0.6)', SHADOW = 'rgba(30,20,14,0.3)';
  const sway = Math.sin(T * 2.6 + ph * 0.5) * (moving ? 1.8 : 1) * s;   // 胡须/飘带摆动

  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = teamCol; g.lineWidth = 2.2 * s;                   // 队伍识别环（脚下）
  g.globalAlpha = alpha * 0.8;
  g.beginPath(); g.ellipse(0, 1 * s, 12 * s, 5 * s, 0, 0, 7); g.stroke();
  g.globalAlpha = alpha;
  if (c.isPlayer) {
    g.strokeStyle = '#ffffffcc'; g.lineWidth = 1.3 * s;
    g.beginPath(); g.ellipse(0, 1 * s, 14.5 * s, 6 * s, 0, 0, 7); g.stroke();
  }
  g.translate(Math.cos(c.vaim) * strike * 2.5 * s, bob);
  g.rotate(((moving ? 0.05 : 0) + strike * 0.05) * faceR);
  g.scale(faceR, 1);
  const localAim = faceR === 1 ? c.vaim : Math.PI - c.vaim;
  g.lineCap = 'round'; g.lineJoin = 'round';

  // ===== 双腿（粗壮，ikJoint 步态）=====
  const hipY = -12.5 * s;
  const stride = moving ? 6 * s : 0, lift = moving ? 3.2 * s : 0, stance = moving ? 0 : 3.6 * s;
  const f1 = [Math.sin(ph) * stride - stance, -Math.max(0, Math.cos(ph)) * lift];
  const f2 = [-Math.sin(ph) * stride + stance, -Math.max(0, -Math.cos(ph)) * lift];
  const kk1 = ikJoint(0, hipY, f1[0], f1[1], 6.4 * s, 6.4 * s, -1);
  const kk2 = ikJoint(0, hipY, f2[0], f2[1], 6.4 * s, 6.4 * s, -1);
  [[kk1, f1], [kk2, f2]].forEach(([kk, ff]) => {
    g.strokeStyle = OUTLINE; g.lineWidth = 5 * s;
    g.beginPath(); g.moveTo(0, hipY); g.lineTo(kk[0], kk[1]); g.lineTo(ff[0], ff[1]); g.stroke();
    g.strokeStyle = pants; g.lineWidth = 4.1 * s;                   // 原画蓝裤
    g.beginPath(); g.moveTo(0, hipY); g.lineTo(kk[0], kk[1]); g.stroke();
    g.strokeStyle = 'rgba(94,141,183,0.4)'; g.lineWidth = 1.1 * s;  // 大腿受光亮边
    g.beginPath(); g.moveTo(-0.5 * s, hipY + 1.2 * s); g.lineTo(kk[0] - 0.5 * s, kk[1] - 1.2 * s); g.stroke();
    g.strokeStyle = boot; g.lineWidth = 4.4 * s;                    // 厚重长靴
    g.beginPath(); g.moveTo(kk[0], kk[1]); g.lineTo(ff[0], ff[1]); g.stroke();
    g.fillStyle = boot;
    g.beginPath(); g.ellipse(ff[0] + 1.5 * s, ff[1] - 0.7 * s, 3.4 * s, 2.2 * s, 0, 0, 7); g.fill();
    g.strokeStyle = leather; g.lineWidth = 0.8 * s;                 // 靴带×2
    g.beginPath(); g.moveTo(kk[0] - 1.6 * s, kk[1] + (ff[1] - kk[1]) * 0.35); g.lineTo(kk[0] + 1.6 * s, kk[1] + (ff[1] - kk[1]) * 0.35); g.stroke();
    g.beginPath(); g.moveTo(kk[0] - 1.6 * s, kk[1] + (ff[1] - kk[1]) * 0.65); g.lineTo(kk[0] + 1.6 * s, kk[1] + (ff[1] - kk[1]) * 0.65); g.stroke();
    g.fillStyle = gold;                                             // 膝甲金钉
    g.beginPath(); g.arc(kk[0], kk[1], 0.8 * s, 0, 7); g.fill();
  });

  // ===== 背带皮草（背后飘的毛边）=====
  g.strokeStyle = leather; g.lineWidth = 2.6 * s;
  g.beginPath();
  g.moveTo(-3.2 * s, -23 * s);
  g.quadraticCurveTo(-6.5 * s - sway * 0.5, -19 * s, -5.8 * s - sway, -14 * s);
  g.stroke();

  // ===== 躯干（赤膊魁梧：宽厚胸肌 + 背光阴影 + 皮革肩带 + 金扣腰带）=====
  const torsoPath = () => {
    g.beginPath();
    g.moveTo(-5.2 * s, -12.8 * s);                                  // 后腰
    g.quadraticCurveTo(-6.4 * s, -17.5 * s, -5 * s, -23 * s);       // 后背
    g.lineTo(-2 * s, -24.5 * s);                                    // 颈后
    g.lineTo(2 * s, -24.5 * s);                                     // 颈前
    g.quadraticCurveTo(6.4 * s, -20 * s, 5 * s, -15 * s);           // 厚胸
    g.quadraticCurveTo(4.6 * s, -13.6 * s, 4.4 * s, -12.8 * s);     // 前腰
    g.quadraticCurveTo(0, -12 * s, -5.2 * s, -12.8 * s);
    g.closePath();
  };
  torsoPath(); g.fillStyle = skin; g.fill();
  g.strokeStyle = OUTLINE; g.lineWidth = 0.8 * s;
  g.stroke();
  g.save();                                                         // 背光阴影
  torsoPath(); g.clip();
  g.fillStyle = SHADOW;
  g.beginPath(); g.ellipse(-6.2 * s, -18.5 * s, 4 * s, 6.5 * s, 0, 0, 7); g.fill();
  g.restore();
  g.strokeStyle = skinDk; g.lineWidth = 0.9 * s;                    // 胸肌线条
  g.beginPath(); g.moveTo(2.6 * s, -22.6 * s); g.quadraticCurveTo(4.4 * s, -20 * s, 3.2 * s, -17.5 * s); g.stroke();
  g.strokeStyle = 'rgba(230,175,130,0.5)'; g.lineWidth = 1.1 * s;   // 前胸受光亮边
  g.beginPath(); g.moveTo(2.2 * s, -24.1 * s); g.quadraticCurveTo(6.5 * s, -19.8 * s, 5.1 * s, -15.1 * s); g.stroke();
  g.strokeStyle = skinDk; g.lineWidth = 0.7 * s;                    // 腹肌线两道
  g.beginPath(); g.moveTo(1.4 * s, -16.4 * s); g.lineTo(3.2 * s, -16.2 * s); g.stroke();
  g.beginPath(); g.moveTo(1.6 * s, -14.9 * s); g.lineTo(3.3 * s, -14.8 * s); g.stroke();
  g.strokeStyle = hair; g.lineWidth = 0.6 * s;                      // 胸毛三撮
  g.beginPath(); g.moveTo(2.4 * s, -21.4 * s); g.quadraticCurveTo(2.7 * s, -20.9 * s, 2.5 * s, -20.4 * s); g.stroke();
  g.beginPath(); g.moveTo(1.7 * s, -21 * s); g.quadraticCurveTo(2 * s, -20.5 * s, 1.8 * s, -20 * s); g.stroke();
  g.beginPath(); g.moveTo(3.1 * s, -21.2 * s); g.quadraticCurveTo(3.4 * s, -20.7 * s, 3.2 * s, -20.2 * s); g.stroke();
  g.strokeStyle = leather; g.lineWidth = 2 * s;                     // 斜挎皮带（肩到腰）
  g.beginPath(); g.moveTo(-4.4 * s, -23.2 * s); g.lineTo(3.4 * s, -14.2 * s); g.stroke();
  g.fillStyle = leather;                                            // 皮革腰带 + 金扣 + 队色饰
  g.fillRect(-5.6 * s, -14.2 * s, 10.4 * s, 2 * s);
  g.fillStyle = gold;
  g.fillRect(-1.1 * s, -14.5 * s, 2.2 * s, 2.6 * s);
  g.fillStyle = teamCol;
  g.fillRect(2.6 * s, -14.3 * s, 1.8 * s, 2.2 * s);
  g.fillStyle = leather;                                            // 髋侧腰包
  g.beginPath(); g.roundRect(-5.9 * s, -14.4 * s, 3 * s, 3.4 * s, 0.6 * s); g.fill();
  g.strokeStyle = OUTLINE; g.lineWidth = 0.5 * s;
  g.stroke();
  g.strokeStyle = gold; g.lineWidth = 0.6 * s;                      // 腰包扣
  g.beginPath(); g.moveTo(-5.3 * s, -13 * s); g.lineTo(-3.7 * s, -13 * s); g.stroke();

  // ===== 持盾臂 + 门板巨盾（蓄力收盾 → 前顶盾击）=====
  const armAng = localAim + 1.1 - strike * 1.5;
  const reach = 6 + Math.max(0, strike) * 3.5 + Math.max(0, -strike) * 1;
  const hx2 = 1.6 * s + Math.cos(armAng) * reach * s;
  const hy2 = -22.6 * s + Math.sin(armAng) * reach * s * 0.85;
  const el2 = ikJoint(1.6 * s, -22.6 * s, hx2, hy2, 6.4 * s, 6.4 * s, -1);
  g.strokeStyle = OUTLINE; g.lineWidth = 4.2 * s;                   // 粗壮手臂
  g.beginPath(); g.moveTo(1.6 * s, -22.6 * s); g.lineTo(el2[0], el2[1]); g.lineTo(hx2, hy2); g.stroke();
  g.strokeStyle = skin; g.lineWidth = 3.4 * s;
  g.beginPath(); g.moveTo(1.6 * s, -22.6 * s); g.lineTo(el2[0], el2[1]); g.lineTo(hx2, hy2); g.stroke();
  g.fillStyle = leather;                                            // 臂甲皮环
  g.beginPath(); g.arc(el2[0], el2[1], 1.6 * s, 0, 7); g.fill();
  // 门板巨盾：竖直大门板，金边横梁 + 中心符文
  g.save();
  g.translate(hx2, hy2); g.rotate(armAng);
  g.fillStyle = door; g.strokeStyle = OUTLINE; g.lineWidth = 0.8 * s;
  g.beginPath(); g.roundRect(-2.2 * s, -7.5 * s, 5.5 * s, 15 * s, 1.5 * s); g.fill(); g.stroke();
  g.strokeStyle = doorDk; g.lineWidth = 0.7 * s;                    // 门板拼缝
  g.beginPath(); g.moveTo(0.5 * s, -6.5 * s); g.lineTo(0.5 * s, 6.5 * s); g.stroke();
  g.strokeStyle = gold; g.lineWidth = 1.1 * s;                      // 金色横梁×2
  g.beginPath(); g.moveTo(-2 * s, -3.6 * s); g.lineTo(3.1 * s, -3.6 * s); g.stroke();
  g.beginPath(); g.moveTo(-2 * s, 3.6 * s); g.lineTo(3.1 * s, 3.6 * s); g.stroke();
  g.strokeStyle = teamCol; g.lineWidth = 1 * s;                     // 队色符文圈
  g.beginPath(); g.arc(0.6 * s, 0, 1.8 * s, 0, 7); g.stroke();
  g.fillStyle = teamCol;
  g.beginPath(); g.arc(0.6 * s, 0, 0.7 * s, 0, 7); g.fill();
  g.strokeStyle = doorDk; g.lineWidth = 0.6 * s;                    // 盾面内框线
  g.beginPath(); g.roundRect(-1.5 * s, -6.8 * s, 4.1 * s, 13.6 * s, 1.2 * s); g.stroke();
  g.fillStyle = gold;                                               // 盾角铆钉×4
  [[-1.6, -6.6], [2.7, -6.6], [-1.6, 6.3], [2.7, 6.3]].forEach(([rx, ry]) => {
    g.beginPath(); g.arc(rx * s, ry * s, 0.55 * s, 0, 7); g.fill();
  });
  g.strokeStyle = teamCol; g.lineWidth = 0.55 * s;                  // 符文圈刻痕三道
  g.beginPath(); g.moveTo(0.6 * s, -1.6 * s); g.lineTo(0.6 * s, -0.9 * s); g.stroke();
  g.beginPath(); g.moveTo(0.2 * s, 0.5 * s); g.lineTo(1 * s, 0.5 * s); g.stroke();
  g.beginPath(); g.moveTo(0.6 * s, 1.2 * s); g.lineTo(0.6 * s, 1.7 * s); g.stroke();
  if (strike > 0.4) {                                               // 盾击冲撞气流
    g.strokeStyle = 'rgba(227,232,242,0.55)'; g.lineWidth = 2.5 * s;
    g.beginPath(); g.moveTo(3.5 * s, -3 * s); g.lineTo(6.5 * s, -4 * s); g.stroke();
    g.beginPath(); g.moveTo(3.5 * s, 3 * s); g.lineTo(6.5 * s, 4 * s); g.stroke();
  }
  g.restore();
  g.fillStyle = skin;                                               // 握盾拳
  g.beginPath(); g.arc(hx2, hy2, 1.9 * s, 0, 7); g.fill();

  // ===== 后臂（悬于体侧）=====
  const offY = -13.5 * s;
  const elO = ikJoint(-3.8 * s, -22.6 * s, -3.4 * s, offY, 6.4 * s, 6.4 * s, 1);
  g.strokeStyle = skinDk; g.lineWidth = 3.2 * s;
  g.beginPath(); g.moveTo(-3.8 * s, -22.6 * s); g.lineTo(elO[0], elO[1]); g.lineTo(-3.4 * s, offY); g.stroke();

  // ===== 头（侧脸朝右：光顶 + 短发带 + 橙色大胡须垂胸 + 浓眉）=====
  g.strokeStyle = skin; g.lineWidth = 1.6 * s;                      // 粗颈
  g.beginPath(); g.moveTo(-0.2 * s, -24 * s); g.lineTo(0.5 * s, -25.6 * s); g.stroke();
  g.fillStyle = skin;
  g.beginPath(); g.ellipse(0.9 * s, -28.4 * s, 4.1 * s, 4.6 * s, -0.06, 0, 7); g.fill();
  g.save();                                                         // 头后侧阴影
  g.beginPath(); g.ellipse(0.9 * s, -28.4 * s, 4.1 * s, 4.6 * s, -0.06, 0, 7); g.clip();
  g.fillStyle = 'rgba(140,90,60,0.35)';
  g.beginPath(); g.ellipse(-1.1 * s, -28 * s, 3.4 * s, 4.8 * s, -0.06, 0, 7); g.fill();
  g.restore();
  g.strokeStyle = OUTLINE; g.lineWidth = 0.7 * s;
  g.beginPath(); g.ellipse(0.9 * s, -28.4 * s, 4.1 * s, 4.6 * s, -0.06, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(4.4 * s, -28.7 * s); g.lineTo(5.7 * s, -28 * s); g.lineTo(4.4 * s, -27.4 * s); g.closePath(); g.fill();  // 鼻
  g.fillStyle = hair;                                               // 光顶后的短发带（后脑一圈）
  g.beginPath();
  g.moveTo(2.6 * s, -31.6 * s);
  g.quadraticCurveTo(-1.4 * s, -32.8 * s, -3.6 * s, -30.8 * s);
  g.quadraticCurveTo(-4.6 * s, -28.4 * s, -3.8 * s, -26.6 * s);
  g.lineTo(-2.6 * s, -27.2 * s);
  g.quadraticCurveTo(-3 * s, -29.4 * s, -1.4 * s, -31 * s);
  g.quadraticCurveTo(0.8 * s, -31.4 * s, 2.4 * s, -30.6 * s);
  g.closePath(); g.fill();
  g.strokeStyle = hair; g.lineWidth = 1.2 * s;                      // 浓眉
  g.beginPath(); g.moveTo(1.8 * s, -30 * s); g.lineTo(3.8 * s, -29.9 * s); g.stroke();
  g.fillStyle = '#2a2018';                                          // 眼
  g.beginPath(); g.ellipse(2.9 * s, -28.9 * s, 0.7 * s, 0.5 * s, 0, 0, 7); g.fill();

  // 橙色大胡须：从鼻下蔓延至胸口的浓密络腮胡（布隆标志）
  g.fillStyle = beard;
  g.beginPath();
  g.moveTo(4.6 * s, -27.6 * s);                                     // 鼻下
  g.quadraticCurveTo(4.9 * s, -25 * s, 3.4 * s, -23.4 * s);         // 下颌前
  g.quadraticCurveTo(3 * s + sway * 0.4, -20.4 * s, 1.4 * s + sway * 0.8, -18.6 * s);   // 垂胸
  g.quadraticCurveTo(-0.4 * s + sway, -19.8 * s, -1.6 * s + sway * 0.7, -22.4 * s);     // 胡须尾
  g.quadraticCurveTo(-2.2 * s, -25 * s, -1 * s, -26.4 * s);
  g.lineTo(0.4 * s, -26.2 * s);
  g.quadraticCurveTo(2.6 * s, -26.6 * s, 4.6 * s, -27.6 * s);
  g.closePath(); g.fill();
  g.strokeStyle = beardDk; g.lineWidth = 0.7 * s;                   // 胡须纹理
  g.beginPath(); g.moveTo(2.8 * s, -26.4 * s); g.quadraticCurveTo(2.9 * s + sway * 0.5, -23.4 * s, 2 * s + sway, -20.6 * s); g.stroke();
  g.beginPath(); g.moveTo(1.2 * s, -26 * s); g.quadraticCurveTo(1 * s + sway * 0.6, -23.6 * s, 0.4 * s + sway * 0.9, -21.4 * s); g.stroke();
  g.strokeStyle = 'rgba(245,175,95,0.65)'; g.lineWidth = 0.7 * s;   // 胡须亮色发丝两道
  g.beginPath(); g.moveTo(3.6 * s, -26.2 * s); g.quadraticCurveTo(3.7 * s + sway * 0.4, -23.6 * s, 2.9 * s + sway * 0.8, -21.2 * s); g.stroke();
  g.beginPath(); g.moveTo(0.3 * s, -25.6 * s); g.quadraticCurveTo(0.1 * s + sway * 0.5, -23.4 * s, -0.3 * s + sway * 0.8, -21.6 * s); g.stroke();
  g.strokeStyle = beard; g.lineWidth = 2.4 * s;                     // 翘胡须尖
  g.beginPath(); g.moveTo(4.2 * s, -27 * s); g.quadraticCurveTo(5.6 * s, -27.6 * s, 6.2 * s, -28.4 * s); g.stroke();

  g.restore();
  g.globalAlpha = 1;
}

// 辅助建模 v3（右侧视角矢量，参照萨勒芬妮立绘）：修长身形（约 4 头身）+ 粉色渐变双马尾 + 星饰
// + 紫罗兰舞台演出服 + 海克斯音杖（举杖施法，宝珠随普攻发亮）；默认朝右，faceR=-1 时整体镜像
function drawSupportModel(c, alpha, g) {
  g = g || ctx;
  const rd = ROLES[c.role], s = rd.r / 15;
  const teamCol = TEAMCOL[c.team];
  const moving = Math.hypot(c.vx, c.vy) > 20;
  const faceR = Math.cos(c.vaim) >= 0 ? 1 : -1;
  const ph = c.walkPhase, T = gameTime;
  const ap = 1 - c.atkCdT / rd.atkCd;

  let strike = 0;                                                   // 三段：-1 蓄力抬杖 → +1 挥出 → 0 收势
  if (ap < 0.4) {
    const at = ap / 0.4;
    if (at < 0.3) strike = -at / 0.3;
    else if (at < 0.55) strike = -1 + ((at - 0.3) / 0.25) * 2;
    else strike = 1 - (at - 0.55) / 0.45;
  }
  // 举杖程度帧间平滑：攻击窗口举起，连续施法保持，停手后缓缓放下
  const raiseTgt = (ap < 0.45 || T - c.lastCombat < 0.7) ? 1 : 0;
  if (c.staffRaise === undefined) c.staffRaise = 0;
  c.staffRaise += (raiseTgt - c.staffRaise) * 0.22;
  const raise = c.staffRaise;

  const bob = moving ? Math.abs(Math.sin(ph)) * 1.4 * s : Math.sin(T * 2.2) * 0.7 * s;

  // 配色（参照萨勒芬妮立绘）
  const skin = '#eec4b0', skinDk = '#d4a396', bodice = '#7a5a9e', bodiceDk = '#57407a',
        skirt = '#6a4d8c', pink = '#ea7bae', pinkDk = '#c75d95', gold = '#c9a557',
        stocking = '#685786', shoe = '#4f84bc', shoeLt = '#5fa8e7',
        OUTLINE = 'rgba(24,16,28,0.55)', SHADOW = 'rgba(30,20,40,0.28)';
  const hairGrad = pinkHairGradOf(g, s);                  // 缓存的粉色渐变发
  const sway = Math.sin(T * 2.8 + ph * 0.5) * (moving ? 2.4 : 1.3) * s;   // 马尾/裙摆摆动

  g.save();
  g.globalAlpha = alpha;
  g.strokeStyle = teamCol; g.lineWidth = 2.2 * s;                   // 队伍识别环（脚下）
  g.globalAlpha = alpha * 0.8;
  g.beginPath(); g.ellipse(0, 1 * s, 10.5 * s, 4.4 * s, 0, 0, 7); g.stroke();
  g.globalAlpha = alpha;
  if (c.isPlayer) {
    g.strokeStyle = '#ffffffcc'; g.lineWidth = 1.3 * s;
    g.beginPath(); g.ellipse(0, 1 * s, 12.8 * s, 5.4 * s, 0, 0, 7); g.stroke();
  }
  g.translate(Math.cos(c.vaim) * strike * 2 * s, bob);
  g.rotate(((moving ? 0.06 : 0) + strike * 0.04) * faceR);
  g.scale(faceR, 1);
  const localAim = faceR === 1 ? c.vaim : Math.PI - c.vaim;
  g.lineCap = 'round'; g.lineJoin = 'round';

  // ===== 双腿（纤细，过膝袜 + 蓝色舞台鞋）=====
  const hipY = -13 * s;
  const stride = moving ? 6 * s : 0, lift = moving ? 3.5 * s : 0, stance = moving ? 0 : 2.6 * s;
  const f1 = [Math.sin(ph) * stride - stance, -Math.max(0, Math.cos(ph)) * lift];
  const f2 = [-Math.sin(ph) * stride + stance, -Math.max(0, -Math.cos(ph)) * lift];
  const kk1 = ikJoint(0, hipY, f1[0], f1[1], 6.8 * s, 6.8 * s, -1);
  const kk2 = ikJoint(0, hipY, f2[0], f2[1], 6.8 * s, 6.8 * s, -1);
  [[kk1, f1], [kk2, f2]].forEach(([kk, ff], i) => {
    g.strokeStyle = OUTLINE; g.lineWidth = 3.6 * s;
    g.beginPath(); g.moveTo(0, hipY); g.lineTo(kk[0], kk[1]); g.lineTo(ff[0], ff[1]); g.stroke();
    g.strokeStyle = stocking; g.lineWidth = 2.7 * s;                // 过膝袜
    g.beginPath(); g.moveTo(0, hipY); g.lineTo(kk[0], kk[1]); g.stroke();
    g.strokeStyle = 'rgba(157,144,190,0.55)'; g.lineWidth = 0.9 * s;  // 大腿受光亮边
    g.beginPath(); g.moveTo(-0.4 * s, hipY + 1.2 * s); g.lineTo(kk[0] - 0.4 * s, kk[1] - 1 * s); g.stroke();
    g.strokeStyle = pinkDk; g.lineWidth = 0.8 * s;                   // 袜口线
    g.beginPath(); g.moveTo(kk[0] - 1.2 * s, hipY + (kk[1] - hipY) * 0.28); g.lineTo(kk[0] + 1.2 * s, hipY + (kk[1] - hipY) * 0.28); g.stroke();
    g.strokeStyle = stocking;                                        // 双腿同色（过膝袜）
    g.beginPath(); g.moveTo(kk[0], kk[1]); g.lineTo(ff[0], ff[1]); g.stroke();
    g.fillStyle = shoe;                                             // 舞台鞋
    g.beginPath(); g.ellipse(ff[0] + 1.2 * s, ff[1] - 0.7 * s, 2.6 * s, 1.7 * s, 0, 0, 7); g.fill();
    g.fillStyle = shoeLt;
    g.beginPath(); g.ellipse(ff[0] + 1.6 * s, ff[1] - 0.2 * s, 1.6 * s, 0.8 * s, 0, 0, 7); g.fill();
    g.strokeStyle = OUTLINE; g.lineWidth = 0.5 * s;                 // 鞋底线
    g.beginPath(); g.moveTo(ff[0] - 1.2 * s, ff[1] + 0.5 * s); g.lineTo(ff[0] + 3.4 * s, ff[1] + 0.4 * s); g.stroke();
  });

  // ===== 粉色渐变双马尾（侧视：近侧一束大马尾 + 远侧露出一束，随移动飘摆）=====
  g.fillStyle = hairGrad;
  g.beginPath();                                                    // 远侧马尾（稍暗，身后）
  g.moveTo(-2.4 * s, -31.4 * s);
  g.quadraticCurveTo(-6 * s - sway * 0.6, -28 * s, -6.6 * s - sway, -20 * s);
  g.quadraticCurveTo(-5.6 * s - sway * 0.6, -14 * s, -4.4 * s - sway * 0.3, -10.5 * s);
  g.quadraticCurveTo(-3.8 * s - sway * 0.5, -14 * s, -2.8 * s, -20 * s);
  g.quadraticCurveTo(-1.8 * s, -27 * s, -2.4 * s, -31.4 * s);
  g.closePath(); g.fill();
  g.globalAlpha = alpha * 0.55; g.fillStyle = bodiceDk;             // 压暗远侧
  g.fill(); g.globalAlpha = alpha;
  g.fillStyle = hairGrad;
  g.beginPath();                                                    // 近侧马尾（主视觉）
  g.moveTo(-1.8 * s, -31.6 * s);
  g.quadraticCurveTo(-5.2 * s - sway * 0.8, -27 * s, -5 * s - sway * 1.1, -18.5 * s);
  g.quadraticCurveTo(-4.4 * s - sway * 0.7, -12.5 * s, -2.8 * s - sway * 0.4, -8.8 * s);
  g.quadraticCurveTo(-1.9 * s - sway * 0.5, -13 * s, -1 * s, -19 * s);
  g.quadraticCurveTo(-0.2 * s, -27 * s, -1.8 * s, -31.6 * s);
  g.closePath(); g.fill();
  g.strokeStyle = 'rgba(252,228,240,0.55)'; g.lineWidth = 0.8 * s;  // 发丝高光
  g.beginPath(); g.moveTo(-2.6 * s, -29.6 * s);
  g.quadraticCurveTo(-4.6 * s - sway * 0.8, -23 * s, -3.6 * s - sway * 0.5, -12.5 * s); g.stroke();
  g.strokeStyle = 'rgba(252,228,240,0.35)'; g.lineWidth = 0.7 * s;  // 近侧第二束发丝
  g.beginPath(); g.moveTo(-1.9 * s, -29.2 * s);
  g.quadraticCurveTo(-3.4 * s - sway * 0.9, -23.5 * s, -2.5 * s - sway * 0.4, -14.5 * s); g.stroke();
  g.strokeStyle = 'rgba(252,228,240,0.25)'; g.lineWidth = 0.7 * s;  // 远侧马尾发丝
  g.beginPath(); g.moveTo(-3.2 * s, -29.4 * s);
  g.quadraticCurveTo(-5.6 * s - sway * 0.7, -23.5 * s, -4.9 * s - sway * 0.4, -15 * s); g.stroke();
  g.strokeStyle = pink; g.lineWidth = 1.1 * s;                      // 马尾发束环
  g.beginPath(); g.moveTo(-2.6 * s, -31.2 * s); g.lineTo(-1.4 * s, -31.8 * s); g.stroke();

  // ===== 躯干（舞台演出服：束身上衣 + 粉色饰边 + 短裙摆 + 金链腰带）=====
  const torsoPath = () => {
    g.beginPath();
    g.moveTo(-3 * s, -13.4 * s);
    g.quadraticCurveTo(-3.6 * s, -17.5 * s, -3.1 * s, -22.6 * s);
    g.lineTo(-1.6 * s, -24 * s);
    g.lineTo(1.6 * s, -24 * s);
    g.quadraticCurveTo(3.9 * s, -20 * s, 3 * s, -15.8 * s);
    g.quadraticCurveTo(2.8 * s, -14 * s, 2.6 * s, -13.4 * s);
    g.quadraticCurveTo(0, -12.7 * s, -3 * s, -13.4 * s);
    g.closePath();
  };
  torsoPath(); g.fillStyle = bodice; g.fill();
  g.strokeStyle = OUTLINE; g.lineWidth = 0.7 * s;
  g.stroke();
  g.save();                                                         // 背光阴影
  torsoPath(); g.clip();
  g.fillStyle = SHADOW;
  g.beginPath(); g.ellipse(-4 * s, -18.5 * s, 2.8 * s, 5.5 * s, 0, 0, 7); g.fill();
  g.restore();
  g.strokeStyle = pink; g.lineWidth = 1.1 * s;                      // 领口粉色饰边
  g.beginPath(); g.moveTo(-1.5 * s, -23.7 * s); g.quadraticCurveTo(0.4 * s, -22.6 * s, 1.7 * s, -23.6 * s); g.stroke();
  g.strokeStyle = bodiceDk; g.lineWidth = 0.6 * s;                  // 上衣前缝线
  g.beginPath(); g.moveTo(0.8 * s, -23.2 * s); g.quadraticCurveTo(1.6 * s, -19 * s, 1 * s, -15.4 * s); g.stroke();
  g.strokeStyle = 'rgba(168,128,214,0.55)'; g.lineWidth = 0.8 * s;  // 前胸受光亮边
  g.beginPath(); g.moveTo(1.7 * s, -23.7 * s); g.quadraticCurveTo(4 * s, -19.8 * s, 3.1 * s, -15.9 * s); g.stroke();
  g.strokeStyle = pink; g.lineWidth = 0.8 * s;                      // 肩带
  g.beginPath(); g.moveTo(1 * s, -23.9 * s); g.lineTo(1.9 * s, -22.6 * s); g.stroke();
  g.fillStyle = skirt;                                              // 短裙摆（随移动摆动）
  g.beginPath();
  g.moveTo(-3.4 * s, -14 * s);
  g.quadraticCurveTo(-4.6 * s - sway * 0.4, -11.4 * s, -3.4 * s - sway * 0.6, -10 * s);
  g.lineTo(3 * s - sway * 0.3, -10 * s);
  g.quadraticCurveTo(3.4 * s - sway * 0.2, -11.8 * s, 3 * s, -14 * s);
  g.closePath(); g.fill();
  g.strokeStyle = pinkDk; g.lineWidth = 0.8 * s;                    // 裙摆饰边
  g.beginPath(); g.moveTo(-3.4 * s - sway * 0.6, -10 * s); g.lineTo(3 * s - sway * 0.3, -10 * s); g.stroke();
  g.strokeStyle = 'rgba(50,34,72,0.5)'; g.lineWidth = 0.6 * s;      // 裙褶三道
  g.beginPath(); g.moveTo(-1.8 * s - sway * 0.4, -13.6 * s); g.lineTo(-2.2 * s - sway * 0.5, -10.3 * s); g.stroke();
  g.beginPath(); g.moveTo(0.2 * s - sway * 0.3, -13.6 * s); g.lineTo(0 * s - sway * 0.3, -10.3 * s); g.stroke();
  g.beginPath(); g.moveTo(2.1 * s - sway * 0.2, -13.6 * s); g.lineTo(2.3 * s - sway * 0.1, -10.3 * s); g.stroke();
  g.strokeStyle = gold; g.lineWidth = 1 * s;                        // 金链腰带
  g.beginPath(); g.moveTo(-3.1 * s, -14.2 * s); g.lineTo(2.9 * s, -14.2 * s); g.stroke();
  g.fillStyle = teamCol;                                            // 队色宝石
  g.beginPath(); g.moveTo(-0.9 * s, -15 * s); g.lineTo(0, -14.2 * s); g.lineTo(0.9 * s, -15 * s); g.lineTo(0, -13.4 * s); g.closePath(); g.fill();

  // ===== 后臂（右臂：与左臂同色，自然垂在体侧、肘部贴身不外翻）=====
  const offY = -11.2 * s;
  const elO = ikJoint(-2.6 * s, -22.6 * s, -3.2 * s, offY, 5.8 * s, 5.8 * s, 1);
  g.strokeStyle = skin; g.lineWidth = 2.3 * s;
  g.beginPath(); g.moveTo(-2.6 * s, -22.6 * s); g.lineTo(elO[0], elO[1]); g.lineTo(-3.2 * s, offY); g.stroke();

  // ===== 持杖臂（左臂：肘部朝下，不要朝上）=====
  const staffAng = localAim * raise + (-1.15) * (1 - raise);        // 待机斜靠身侧，施法指向瞄准方向
  const reach = 5.6 + raise * 1.6;
  const hx2 = 1.2 * s + Math.cos(staffAng + 0.25) * reach * s;
  const hy2 = -22.6 * s + Math.sin(staffAng + 0.25) * reach * s * 0.85;
  const el2 = ikJoint(1.2 * s, -22.6 * s, hx2, hy2, 5.8 * s, 5.8 * s, 1);
  g.strokeStyle = OUTLINE; g.lineWidth = 3 * s;
  g.beginPath(); g.moveTo(1.2 * s, -22.6 * s); g.lineTo(el2[0], el2[1]); g.lineTo(hx2, hy2); g.stroke();
  g.strokeStyle = skin; g.lineWidth = 2.4 * s;
  g.beginPath(); g.moveTo(1.2 * s, -22.6 * s); g.lineTo(el2[0], el2[1]); g.lineTo(hx2, hy2); g.stroke();
  g.save();                                                         // 音杖：金杆 + 顶端宝珠
  g.translate(hx2, hy2); g.rotate(staffAng);
  g.strokeStyle = gold; g.lineWidth = 1.8 * s;                      // 金杆
  g.beginPath(); g.moveTo(-2.6 * s, 0); g.lineTo(9 * s, 0); g.stroke();
  g.strokeStyle = pink; g.lineWidth = 1 * s;                        // 杆身刻纹
  g.beginPath(); g.moveTo(0.5 * s, -0.4 * s); g.lineTo(5.5 * s, -0.4 * s); g.stroke();
  g.fillStyle = pink;                                               // 杆身符文点×3
  [1.5, 3.2, 4.9].forEach(rx => { g.beginPath(); g.arc(rx * s, 0.5 * s, 0.35 * s, 0, 7); g.fill(); });
  g.strokeStyle = gold; g.lineWidth = 0.6 * s;                      // 杆身金环
  g.beginPath(); g.moveTo(2.2 * s, -1 * s); g.lineTo(2.2 * s, 1 * s); g.stroke();
  const glow = 2.2 + Math.max(0, strike) * 1.1 + raise * 0.4;       // 宝珠（施法时增大发亮）
  g.save();
  g.shadowColor = pink; g.shadowBlur = 4 + raise * 8;
  g.fillStyle = pink;
  g.beginPath(); g.arc(10 * s, 0, glow * s, 0, 7); g.fill();
  g.restore();
  g.fillStyle = '#ffd7ec';
  g.beginPath(); g.arc(10 * s, 0, glow * 0.45 * s, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,215,236,0.5)'; g.lineWidth = 0.6 * s;   // 宝珠内环光晕
  g.beginPath(); g.arc(10 * s, 0, glow * 0.75 * s, 0, 7); g.stroke();
  g.strokeStyle = gold; g.lineWidth = 0.8 * s;                      // 宝珠托座
  g.beginPath(); g.arc(8.4 * s, 0, 1.3 * s, -1.2, 1.2); g.stroke();
  if (strike > 0.3) {                                               // 施法波纹
    g.strokeStyle = 'rgba(255,215,236,0.6)'; g.lineWidth = 1 * s;
    g.beginPath(); g.arc(10 * s, 0, glow * s + 2.5 * s, -0.9, 0.9); g.stroke();
  }
  g.restore();
  g.fillStyle = skin;                                               // 握杖手
  g.beginPath(); g.arc(hx2, hy2, 1.6 * s, 0, 7); g.fill();

  // ===== 头（侧脸朝右，约 4 头身：大眼 + 星形发饰 + 粉发盖与刘海）=====
  g.strokeStyle = skin; g.lineWidth = 1.3 * s;                      // 颈
  g.beginPath(); g.moveTo(-0.1 * s, -23.6 * s); g.lineTo(0.4 * s, -24.9 * s); g.stroke();
  g.fillStyle = skin;
  g.beginPath(); g.ellipse(0.7 * s, -28.6 * s, 3.9 * s, 4.7 * s, -0.06, 0, 7); g.fill();
  g.save();                                                         // 头后侧阴影
  g.beginPath(); g.ellipse(0.7 * s, -28.6 * s, 3.9 * s, 4.7 * s, -0.06, 0, 7); g.clip();
  g.fillStyle = 'rgba(190,140,125,0.3)';
  g.beginPath(); g.ellipse(-1.1 * s, -28.2 * s, 3.2 * s, 4.9 * s, -0.06, 0, 7); g.fill();
  g.restore();
  g.strokeStyle = OUTLINE; g.lineWidth = 0.7 * s;
  g.beginPath(); g.ellipse(0.7 * s, -28.6 * s, 3.9 * s, 4.7 * s, -0.06, 0, 7); g.stroke();
  g.beginPath(); g.moveTo(4.2 * s, -28.8 * s); g.lineTo(5.5 * s, -28.1 * s); g.lineTo(4.2 * s, -27.5 * s); g.closePath(); g.fill();  // 鼻
  g.strokeStyle = '#8a4a5e'; g.lineWidth = 0.7 * s;                 // 睫毛眼（大眼）
  g.beginPath(); g.moveTo(1.6 * s, -29.6 * s); g.quadraticCurveTo(2.7 * s, -30.2 * s, 3.6 * s, -29.5 * s); g.stroke();
  g.fillStyle = '#4a2846';
  g.beginPath(); g.ellipse(2.7 * s, -29 * s, 1 * s, 0.75 * s, 0, 0, 7); g.fill();
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(3 * s, -29.2 * s, 0.3 * s, 0, 7); g.fill();
  g.strokeStyle = '#e08a8a'; g.lineWidth = 0.7 * s;                 // 腮红
  g.beginPath(); g.arc(3.2 * s, -27.2 * s, 0.9 * s, -0.5, 1); g.stroke();
  g.fillStyle = gold;                                               // 耳坠（金色小环+珠）
  g.beginPath(); g.arc(-1.6 * s, -27.2 * s, 0.55 * s, 0, 7); g.fill();
  g.fillStyle = pink;
  g.beginPath(); g.arc(-1.6 * s, -26.5 * s, 0.35 * s, 0, 7); g.fill();
  g.fillStyle = hairGrad;                                           // 发盖 + 额前刘海
  g.beginPath();
  g.moveTo(4 * s, -29.4 * s);
  g.quadraticCurveTo(3.4 * s, -33.2 * s, -0.4 * s, -33.4 * s);
  g.quadraticCurveTo(-4.2 * s, -33.1 * s, -3.9 * s, -28.6 * s);
  g.quadraticCurveTo(-2.4 * s, -26.4 * s, 0 * s, -26.7 * s);
  g.quadraticCurveTo(1.8 * s, -27.2 * s, 2.4 * s, -28.1 * s);
  g.closePath(); g.fill();
  g.strokeStyle = OUTLINE; g.lineWidth = 0.6 * s;
  g.stroke();
  g.strokeStyle = 'rgba(252,228,240,0.6)'; g.lineWidth = 0.7 * s;   // 发顶高光
  g.beginPath(); g.moveTo(2.6 * s, -31.4 * s); g.quadraticCurveTo(0.6 * s, -32.8 * s, -1.6 * s, -32.2 * s); g.stroke();
  g.beginPath();                                                    // 额前刘海束
  g.moveTo(4 * s, -29.4 * s); g.quadraticCurveTo(4.5 * s, -27.6 * s, 3.4 * s, -26.9 * s);
  g.quadraticCurveTo(2.9 * s, -27.6 * s, 2.7 * s, -28.8 * s);
  g.closePath(); g.fill();
  g.fillStyle = gold;                                               // 星形发饰
  g.save();
  g.translate(2.9 * s, -31.4 * s);
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    const a1 = -Math.PI / 2 + i * Math.PI * 2 / 5, a2 = a1 + Math.PI / 5;
    g.lineTo(Math.cos(a1) * 1.2 * s, Math.sin(a1) * 1.2 * s);
    g.lineTo(Math.cos(a2) * 0.5 * s, Math.sin(a2) * 0.5 * s);
  }
  g.closePath(); g.fill();
  g.restore();

  g.restore();
  g.globalAlpha = 1;
}
