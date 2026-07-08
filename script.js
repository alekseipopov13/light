const screenCanvas = document.getElementById("screenCanvas");
const glowCanvas = document.getElementById("glowCanvas");
const screen = screenCanvas.getContext("2d");
const glow = glowCanvas.getContext("2d", { alpha: true });
const qrMaskCanvas = document.createElement("canvas");
const qrMask = qrMaskCanvas.getContext("2d");
const qrDrawCanvas = document.createElement("canvas");
const qrDraw = qrDrawCanvas.getContext("2d");

const controls = {
  duration: document.getElementById("duration"),
  amplitude: document.getElementById("amplitude"),
  intensity: document.getElementById("intensity"),
  blur: document.getElementById("blur"),
  beamSize: document.getElementById("beamSize"),
  beamLength: document.getElementById("beamLength"),
  fps: document.getElementById("fps"),
};

const outputs = {
  duration: document.getElementById("durationValue"),
  amplitude: document.getElementById("amplitudeValue"),
  intensity: document.getElementById("intensityValue"),
  blur: document.getElementById("blurValue"),
  beamSize: document.getElementById("beamSizeValue"),
  beamLength: document.getElementById("beamLengthValue"),
};

const playToggle = document.getElementById("playToggle");
const previewToggle = document.getElementById("previewToggle");
const exportScreen = document.getElementById("exportScreen");
const exportGlow = document.getElementById("exportGlow");
const exportGlowWebp = document.getElementById("exportGlowWebp");
const statusLine = document.getElementById("status");

const W = 1280;
const H = 1024;
const TAU = Math.PI * 2;
const UI_FONT = '"WB Sans Local", "WB Sans", Arial, sans-serif';
const GOOGLE_FONT = '"Google Sans", "Product Sans", Arial, sans-serif';
const QR_SIZE = 312;
const PARTICLES = makeParticles(56);
const BEAM_PARTICLES = makeBeamParticles(260);
let playing = true;
let startedAt = performance.now();
let pausedAt = 0;
let previewActive = false;
let previewStartedAt = 0;
let previewStartAngle = 0;

const qrImage = new Image();
qrImage.src = "assets/QR.svg";

if ("fonts" in document) {
  document.fonts.load(`28px ${UI_FONT}`);
  document.fonts.load(`17px ${UI_FONT}`);
  document.fonts.load(`24px ${GOOGLE_FONT}`);
  document.fonts.load(`17px ${GOOGLE_FONT}`);
}

function settings() {
  return {
    duration: Number(controls.duration.value),
    amplitude: Number(controls.amplitude.value),
    intensity: Number(controls.intensity.value),
    blur: Number(controls.blur.value),
    beamSize: Number(controls.beamSize.value),
    beamLength: Number(controls.beamLength.value),
    motionLife: 1,
    pulseSpeed: 1.5,
    pulseDepth: 0,
    blurPulse: 0.28,
  };
}

function syncOutputs() {
  outputs.duration.value = Number(controls.duration.value).toFixed(1);
  outputs.amplitude.value = Number(controls.amplitude.value).toFixed(2);
  outputs.intensity.value = Number(controls.intensity.value).toFixed(2);
  outputs.blur.value = Number(controls.blur.value).toFixed(2);
  outputs.beamSize.value = Number(controls.beamSize.value).toFixed(2);
  outputs.beamLength.value = Number(controls.beamLength.value).toFixed(2);
}

Object.values(controls).forEach((control) => {
  control.addEventListener("input", syncOutputs);
});
syncOutputs();

function makeParticles(count) {
  return Array.from({ length: count }, (_, index) => {
    const a = seeded(index, 1);
    const b = seeded(index, 2);
    const c = seeded(index, 3);
    const d = seeded(index, 4);
    const e = seeded(index, 5);
    const f = seeded(index, 6);

    return {
      offset: a,
      x: -W * 0.08 + a * W * 1.16,
      y: H * (0.06 + b * 0.86),
      travelX: 20 + c * 64,
      travelY: 16 + d * 54,
      speed: 1,
      swaySpeed: 1,
      riseSpeed: 1,
      twinkleSpeed: 1 + Math.floor(seeded(index, 10) * 2),
      wave: f,
      size: 0.8 + seeded(index, 7) * 1.65,
      alpha: 0.075 + seeded(index, 8) * 0.1,
      hue: seeded(index, 11),
    };
  });
}

function makeBeamParticles(count) {
  return Array.from({ length: count }, (_, index) => {
    const a = seeded(index, 21);
    const b = seeded(index, 22);
    const c = seeded(index, 23);
    const d = seeded(index, 24);
    const e = seeded(index, 25);

    return {
      offset: a,
      side: b < 0.5 ? -1 : 1,
      depth: 0.2 + c * 0.96,
      spread: 14 + d * 62,
      drift: 18 + e * 46,
      speed: 1 + Math.floor(seeded(index, 26) * 4),
      size: 0.2 + seeded(index, 27) * 0.5,
      alpha: 0.075 + seeded(index, 28) * 0.085,
    };
  });
}

function seeded(index, salt) {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function scanPose(time, options) {
  const phase = ((time / options.duration) % 1 + 1) % 1;
  const breathe = Math.sin(TAU * phase);
  const blurBreath = Math.sin(TAU * phase + 1.2);
  const sizeBreath = Math.sin(TAU * phase * 2 + 0.35);
  const lengthBreath = Math.sin(TAU * phase * 2 + 1.7);
  const lookA = Math.sin(TAU * phase);
  const lookB = Math.sin(TAU * phase * 2 + 0.9) * 0.26;
  const lookC = Math.sin(TAU * phase * 3 - 0.4) * 0.16;
  const amp = options.amplitude;
  const look = (lookA + lookB + lookC) * amp * (0.5 + options.motionLife * 0.45);
  const dynamicScale = 0.5 + 0.5 * Math.sin(TAU * phase * 2 - 0.5);
  const focus = 0.5 + 0.5 * Math.sin(TAU * phase * 3 + 1.4);
  const flameA = Math.sin(TAU * phase * 2 + 0.75);
  const flameB = Math.sin(TAU * phase * 3 - 1.1);
  const flameC = Math.sin(TAU * phase * 4 + 2.35);
  const sceneLift = 0.78 + dynamicScale * 0.18 + (sizeBreath + 1) * 0.04 + (lengthBreath + 1) * 0.035;

  return {
    sourceX: W / 2,
    sourceY: -600,
    angle: -look * 0.28 + Math.sin(TAU * phase * 2 + 0.2) * 0.035,
    width: options.beamSize * (1.22 + dynamicScale * 0.1 + sizeBreath * (0.035 + options.motionLife * 0.035)),
    length: options.beamLength * (1.08 + dynamicScale * 0.15 + lengthBreath * (0.06 + options.motionLife * 0.065)),
    pulse: 0.9 + breathe * options.pulseDepth + Math.sin(TAU * phase * 2 + 0.5) * options.pulseDepth * 0.35,
    softness: 1.08 + blurBreath * options.blurPulse,
    focus: 0.94 + focus * 0.16,
    flameA,
    flameB,
    flameC,
    sceneLift,
  };
}

function drawGlowLayer(ctx, time, options, forcedAngle = null, previewFocusProgress = 0) {
  const basePose = scanPose(time, options);
  const pose = forcedAngle === null ? basePose : { ...basePose, angle: forcedAngle };
  const focusMix = easeOutCubic(clamp(previewFocusProgress / 0.75, 0, 1));
  if (focusMix > 0) {
    pose.width = lerp(basePose.width, options.beamSize * 1.28, focusMix);
    pose.length = lerp(basePose.length, options.beamLength * 1.02, focusMix);
    pose.softness = lerp(basePose.softness, 1.08, focusMix);
    pose.focus = lerp(basePose.focus, 1.05, focusMix);
    pose.sceneLift = lerp(basePose.sceneLift, 0.92, focusMix);
  }
  const intensity = options.intensity * pose.pulse;
  const blurScale = options.blur * pose.softness;
  const sourceX = pose.sourceX;
  const sourceY = pose.sourceY;

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  drawSceneBrightness(ctx, pose, blurScale, intensity);

  ctx.translate(sourceX, sourceY);
  ctx.rotate(pose.angle);

  const bodyX = 0;
  const bodyY = 410 * pose.length;

  drawColorEchoes(ctx, pose, bodyY, blurScale, intensity);
  drawFocusedBeamShaft(ctx, pose, bodyY, blurScale, intensity);

  ctx.filter = `blur(${Math.round(72 * blurScale)}px)`;
  drawEllipseGlow(ctx, bodyX, bodyY * 1.08, 680 * pose.width * blurScale, 730 * pose.length * blurScale, 0, [
    [0, `rgba(198, 28, 148, ${0.12 * intensity})`],
    [0.28, `rgba(139, 16, 103, ${0.085 * intensity})`],
    [0.62, `rgba(54, 7, 40, ${0.043 * intensity})`],
    [0.9, `rgba(10, 1, 8, ${0.02 * intensity})`],
    [1, "rgba(0, 0, 0, 0)"],
  ]);

  ctx.filter = `blur(${Math.round(24 * blurScale)}px)`;
  drawEllipseGlow(ctx, bodyX, bodyY, 390 * pose.width * blurScale, 620 * pose.length * blurScale, 0, [
    [0, `rgba(255, 232, 253, ${0.4 * intensity})`],
    [0.14, `rgba(251, 135, 225, ${0.35 * intensity})`],
    [0.31, `rgba(230, 49, 190, ${0.29 * intensity})`],
    [0.52, `rgba(156, 20, 112, ${0.16 * intensity})`],
    [0.72, `rgba(72, 7, 51, ${0.075 * intensity})`],
    [0.9, `rgba(20, 3, 15, ${0.035 * intensity})`],
    [1, "rgba(0, 0, 0, 0)"],
  ]);

  ctx.filter = `blur(${Math.round(32 * blurScale)}px)`;
  drawEllipseGlow(ctx, pose.flameB * 24, bodyY * (0.72 + pose.flameA * 0.015), 300 * pose.width * blurScale, 220 * pose.length * blurScale, pose.flameC * 0.035, [
    [0, `rgba(255, 255, 210, ${0.2 * intensity})`],
    [0.22, `rgba(255, 209, 66, ${0.12 * intensity})`],
    [0.52, `rgba(255, 100, 52, ${0.065 * intensity})`],
    [0.84, `rgba(202, 20, 128, ${0.04 * intensity})`],
    [1, "rgba(0, 0, 0, 0)"],
  ]);

  drawFlameDepth(ctx, pose, bodyY, blurScale, intensity);

  ctx.filter = `blur(${Math.round(17 * blurScale)}px)`;
  drawEllipseGlow(ctx, bodyX, bodyY * 0.88, 185 * pose.focus * blurScale, 355 * pose.length * blurScale, 0, [
    [0, `rgba(255, 252, 254, ${0.42 * intensity})`],
    [0.22, `rgba(255, 179, 239, ${0.31 * intensity})`],
    [0.52, `rgba(230, 48, 190, ${0.12 * intensity})`],
    [0.78, `rgba(115, 12, 82, ${0.05 * intensity})`],
    [1, "rgba(0, 0, 0, 0)"],
  ]);

  ctx.filter = `blur(${Math.round(54 * blurScale)}px)`;
  drawEllipseGlow(ctx, bodyX, bodyY * 1.2, 560 * pose.width * blurScale, 600 * pose.length * blurScale, 0, [
    [0, `rgba(220, 41, 178, ${0.11 * intensity})`],
    [0.34, `rgba(137, 15, 98, ${0.075 * intensity})`],
    [0.64, `rgba(54, 7, 38, ${0.042 * intensity})`],
    [0.86, `rgba(14, 2, 10, ${0.025 * intensity})`],
    [1, "rgba(0, 0, 0, 0)"],
  ]);

  ctx.filter = "none";

  ctx.restore();

  drawLightParticles(ctx, time, options, pose, bodyY, blurScale, intensity);
  drawBeamParticles(ctx, time, options, pose, bodyY, blurScale, intensity);
}

function drawFocusedBeamShaft(ctx, pose, bodyY, blurScale, intensity) {
  const yStart = bodyY * 0.44;
  const yEnd = bodyY * 1.55;
  const topWidth = 24 * pose.width * blurScale;
  const bottomWidth = 220 * pose.width * blurScale;

  ctx.save();
  ctx.filter = `blur(${Math.round(18 * blurScale)}px)`;
  let gradient = ctx.createLinearGradient(0, yStart, 0, yEnd);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  gradient.addColorStop(0.18, `rgba(255, 222, 251, ${0.06 * intensity})`);
  gradient.addColorStop(0.46, `rgba(238, 52, 195, ${0.13 * intensity})`);
  gradient.addColorStop(0.76, `rgba(164, 18, 118, ${0.08 * intensity})`);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  drawTaperedPath(ctx, yStart, yEnd, topWidth, bottomWidth);

  ctx.filter = `blur(${Math.round(7 * blurScale)}px)`;
  gradient = ctx.createLinearGradient(0, yStart, 0, yEnd);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  gradient.addColorStop(0.2, `rgba(255, 250, 254, ${0.09 * intensity})`);
  gradient.addColorStop(0.48, `rgba(255, 159, 236, ${0.14 * intensity})`);
  gradient.addColorStop(0.78, `rgba(225, 48, 186, ${0.055 * intensity})`);
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  drawTaperedPath(ctx, yStart, yEnd, topWidth * 0.34, bottomWidth * 0.36);

  ctx.filter = "none";
  ctx.restore();
}

function drawTaperedPath(ctx, yStart, yEnd, topWidth, bottomWidth) {
  const curve = (yEnd - yStart) * 0.36;
  ctx.beginPath();
  ctx.moveTo(-topWidth, yStart);
  ctx.bezierCurveTo(-topWidth * 1.25, yStart + curve, -bottomWidth, yEnd - curve * 0.4, -bottomWidth, yEnd);
  ctx.lineTo(bottomWidth, yEnd);
  ctx.bezierCurveTo(bottomWidth, yEnd - curve * 0.4, topWidth * 1.25, yStart + curve, topWidth, yStart);
  ctx.closePath();
  ctx.fill();
}

function drawColorEchoes(ctx, pose, bodyY, blurScale, intensity) {
  const blueBreath = 1 + pose.flameA * 0.34 + pose.flameC * 0.14;
  const orangeBreath = 1 + pose.flameB * 0.34 - pose.flameA * 0.12;
  const sharedBreath = 1 + pose.flameC * 0.22;
  const flameWideA = 1 + Math.max(0, pose.flameA) * 0.42;
  const flameWideB = 1 + Math.max(0, -pose.flameB) * 0.38;
  const echoes = [
    {
      x: pose.flameB * 28,
      y: bodyY * (0.78 + pose.flameA * 0.024),
      rx: 690 * pose.width * sharedBreath * flameWideA,
      ry: 300 * pose.length * orangeBreath,
      blur: 72,
      rotate: pose.flameC * 0.045,
      alpha: 0.24,
      stops: [
        [0, "rgba(255, 236, 112, ALPHA)"],
        [0.24, "rgba(255, 143, 56, ALPHA2)"],
        [0.58, "rgba(228, 48, 146, ALPHA3)"],
        [1, "rgba(0, 0, 0, 0)"],
      ],
    },
    {
      x: -135 * pose.width + pose.flameB * 34,
      y: bodyY * (0.88 + pose.flameA * 0.028),
      rx: 520 * pose.width * blueBreath * flameWideB,
      ry: 320 * pose.length * sharedBreath,
      blur: 58,
      rotate: -0.08 + pose.flameC * 0.035,
      alpha: 0.22,
      stops: [
        [0, "rgba(180, 247, 255, ALPHA)"],
        [0.22, "rgba(72, 195, 255, ALPHA2)"],
        [0.6, "rgba(28, 92, 210, ALPHA3)"],
        [1, "rgba(0, 0, 0, 0)"],
      ],
    },
    {
      x: 140 * pose.width + pose.flameC * 36,
      y: bodyY * (0.92 + pose.flameB * 0.03),
      rx: 540 * pose.width * orangeBreath * flameWideA,
      ry: 340 * pose.length * sharedBreath,
      blur: 60,
      rotate: 0.08 + pose.flameA * 0.035,
      alpha: 0.2,
      stops: [
        [0, "rgba(255, 219, 132, ALPHA)"],
        [0.24, "rgba(255, 132, 58, ALPHA2)"],
        [0.62, "rgba(176, 62, 28, ALPHA3)"],
        [1, "rgba(0, 0, 0, 0)"],
      ],
    },
    {
      x: -220 * pose.width + pose.flameA * 44,
      y: bodyY * (1.05 + pose.flameC * 0.025),
      rx: 330 * pose.width * sharedBreath * flameWideB,
      ry: 470 * pose.length * blueBreath,
      blur: 62,
      rotate: -0.18 + pose.flameB * 0.05,
      alpha: 0.18,
      stops: [
        [0, "rgba(108, 224, 255, ALPHA)"],
        [0.28, "rgba(36, 148, 255, ALPHA2)"],
        [0.72, "rgba(24, 62, 150, ALPHA3)"],
        [1, "rgba(0, 0, 0, 0)"],
      ],
    },
    {
      x: 230 * pose.width + pose.flameB * 44,
      y: bodyY * (1.07 + pose.flameA * 0.025),
      rx: 340 * pose.width * sharedBreath * flameWideA,
      ry: 500 * pose.length * orangeBreath,
      blur: 64,
      rotate: 0.18 + pose.flameC * 0.05,
      alpha: 0.17,
      stops: [
        [0, "rgba(255, 190, 90, ALPHA)"],
        [0.28, "rgba(255, 106, 48, ALPHA2)"],
        [0.7, "rgba(150, 48, 24, ALPHA3)"],
        [1, "rgba(0, 0, 0, 0)"],
      ],
    },
    {
      x: pose.flameC * 30,
      y: bodyY * (0.62 + pose.flameB * 0.018),
      rx: 620 * pose.width * sharedBreath,
      ry: 170 * pose.length,
      blur: 50,
      rotate: pose.flameA * 0.012,
      alpha: 0.13,
      stops: [
        [0, "rgba(255, 252, 255, ALPHA)"],
        [0.22, "rgba(255, 200, 243, ALPHA2)"],
        [0.52, "rgba(255, 142, 225, ALPHA3)"],
        [1, "rgba(0, 0, 0, 0)"],
      ],
    },
  ];

  echoes.forEach((echo) => {
    const a = echo.alpha * intensity;
    ctx.filter = `blur(${Math.round(echo.blur * blurScale)}px)`;
    drawEllipseGlow(
      ctx,
      echo.x,
      echo.y,
      echo.rx * blurScale,
      echo.ry * blurScale,
      echo.rotate,
      echo.stops.map(([offset, color]) => [
        offset,
        color
          .replace("ALPHA3", (a * 0.44).toFixed(4))
          .replace("ALPHA2", (a * 0.9).toFixed(4))
          .replace("ALPHA", a.toFixed(4)),
      ])
    );
  });
}

function drawLightParticles(ctx, time, options, pose, bodyY, blurScale, intensity) {
  const cycle = ((time / options.duration) % 1 + 1) % 1;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = `blur(${Math.max(0.6, 1.1 * blurScale)}px)`;

  PARTICLES.forEach((particle) => {
    const phase = TAU * (cycle * particle.speed + particle.offset);
    const swayPhase = TAU * (cycle * particle.swaySpeed + particle.wave);
    const twinklePhase = TAU * (cycle * particle.twinkleSpeed + particle.offset * 0.37);
    const risePhase = TAU * (cycle * particle.riseSpeed + particle.wave);
    const crossPhase = TAU * (cycle * (particle.speed + particle.swaySpeed + 1) + particle.wave);
    const x =
      particle.x +
      Math.sin(phase) * particle.travelX +
      Math.cos(crossPhase) * particle.travelX * 0.38;
    const y =
      particle.y +
      Math.cos(swayPhase) * particle.travelY +
      Math.sin(risePhase) * particle.travelY * 0.46;
    const lightMask = beamMaskAtPoint(x, y, pose, bodyY, blurScale);
    const twinkle = 0.48 + 0.52 * (0.5 + 0.5 * Math.sin(twinklePhase));
    const alpha = lightMask * twinkle * particle.alpha * intensity * 1.45;
    if (alpha <= 0.003) return;

    const radius = particle.size * (0.8 + lightMask * 0.78) * blurScale;
    const warm = particle.hue > 0.72;
    const cool = particle.hue < 0.24;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.1);
    glow.addColorStop(0, `rgba(255, 250, 254, ${alpha})`);
    glow.addColorStop(
      0.34,
      warm
        ? `rgba(255, 182, 92, ${alpha * 0.62})`
        : cool
          ? `rgba(126, 232, 255, ${alpha * 0.58})`
          : `rgba(255, 166, 235, ${alpha * 0.54})`
    );
    glow.addColorStop(1, "rgba(255, 90, 210, 0)");
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 3.1, 0, TAU);
    ctx.fill();
  });

  ctx.filter = "none";
  ctx.restore();
}

function drawBeamParticles(ctx, time, options, pose, bodyY, blurScale, intensity) {
  const cycle = ((time / options.duration) % 1 + 1) % 1;
  const cos = Math.cos(pose.angle);
  const sin = Math.sin(pose.angle);

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.filter = `blur(${Math.max(0.15, 0.42 * blurScale)}px)`;

  BEAM_PARTICLES.forEach((particle) => {
    const t = (cycle * particle.speed + particle.offset) % 1;
    const eased = easeOutCubic(t);
    const localY = bodyY * particle.depth + Math.sin(TAU * (cycle + particle.offset)) * 26;
    const baseWidth = (55 + localY * 0.19) * pose.width * blurScale;
    const localX =
      particle.side * (baseWidth * 0.16 + particle.spread * eased) +
      Math.sin(TAU * (cycle * (particle.speed + 1) + particle.offset)) * particle.drift * 0.22;
    const fade = Math.sin(Math.PI * t);
    const distanceFade = 1 - eased * 0.82;
    const alpha = fade * distanceFade * particle.alpha * intensity * 1.55;
    if (alpha <= 0.003) return;

    const x = pose.sourceX + localX * cos - localY * sin;
    const y = pose.sourceY + localX * sin + localY * cos;
    const radius = particle.size * (1 + fade * 0.32) * blurScale * 2.15;
    ctx.fillStyle = `rgba(255, 186, 239, ${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, TAU);
    ctx.fill();
  });

  ctx.filter = "none";
  ctx.restore();
}

function beamMaskAtPoint(x, y, pose, bodyY, blurScale) {
  const dx = x - pose.sourceX;
  const dy = y - pose.sourceY;
  const cos = Math.cos(pose.angle);
  const sin = Math.sin(pose.angle);
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;

  if (localY < bodyY * 0.14 || localY > bodyY * 1.9) return 0;

  const beamWidth = (130 + Math.max(0, localY) * 0.42) * pose.width * blurScale;
  const horizontalMask = clamp(1 - Math.abs(localX) / beamWidth, 0, 1);
  const verticalMask = clamp(1 - Math.abs(localY - bodyY * 0.96) / (bodyY * 0.92), 0, 1);
  const coreMask = clamp(1 - Math.abs(localY - bodyY * 0.76) / (bodyY * 0.58), 0, 1);
  return Math.pow(horizontalMask, 2.2) * (0.28 + Math.pow(Math.max(verticalMask, coreMask), 0.7) * 0.72);
}

function drawSceneBrightness(ctx, pose, blurScale, intensity) {
  const dirX = -Math.sin(pose.angle);
  const dirY = Math.cos(pose.angle);
  const sideX = Math.cos(pose.angle);
  const sideY = Math.sin(pose.angle);
  const lift = pose.sceneLift * intensity;
  const layers = [
    { reach: 240, side: pose.flameA * 24, rx: 680, ry: 340, blur: 64, alpha: 0.19, tilt: -0.12 },
    { reach: 420, side: -42 + pose.flameB * 42, rx: 880, ry: 560, blur: 78, alpha: 0.155, tilt: 0.08 },
    { reach: 610, side: 58 + pose.flameC * 54, rx: 1060, ry: 720, blur: 92, alpha: 0.105, tilt: -0.13 },
  ];

  ctx.save();

  drawTopSceneWash(ctx, pose, blurScale, intensity);

  layers.forEach((layer) => {
    const reach = layer.reach * pose.length;
    const x = pose.sourceX + dirX * reach + sideX * layer.side;
    const y = pose.sourceY + dirY * reach + sideY * layer.side;

    ctx.filter = `blur(${Math.round(layer.blur * blurScale)}px)`;
    drawEllipseGlow(ctx, x, y, layer.rx * pose.width * blurScale, layer.ry * pose.length * blurScale, pose.angle * layer.tilt, [
      [0, `rgba(255, 184, 243, ${layer.alpha * 0.74 * lift})`],
      [0.2, `rgba(224, 62, 184, ${layer.alpha * 0.66 * lift})`],
      [0.48, `rgba(127, 18, 92, ${layer.alpha * 0.46 * lift})`],
      [0.74, `rgba(44, 5, 32, ${layer.alpha * 0.28 * lift})`],
      [1, "rgba(0, 0, 0, 0)"],
    ]);
  });

  ctx.filter = `blur(${Math.round(72 * blurScale)}px)`;
  drawEllipseGlow(ctx, pose.sourceX, 42, 760 * pose.width * blurScale, 360 * blurScale, 0, [
    [0, `rgba(255, 226, 252, ${0.2 * lift})`],
    [0.24, `rgba(235, 70, 196, ${0.15 * lift})`],
    [0.58, `rgba(120, 14, 88, ${0.085 * lift})`],
    [0.88, `rgba(18, 2, 13, ${0.035 * lift})`],
    [1, "rgba(0, 0, 0, 0)"],
  ]);

  ctx.filter = "none";
  ctx.restore();
}

function drawTopSceneWash(ctx, pose, blurScale, intensity) {
  const angleShift = -Math.sin(pose.angle) * 240;
  const lift = pose.sceneLift * intensity;
  const widthPulse = 1 + pose.flameA * 0.18 + pose.flameC * 0.08;
  const heightPulse = 1 + pose.flameB * 0.12;
  const x = pose.sourceX + angleShift + pose.flameB * 44;
  const y = -24 + pose.flameA * 18;

  ctx.filter = `blur(${Math.round(78 * blurScale)}px)`;
  drawEllipseGlow(ctx, x, y, 1320 * pose.width * blurScale * widthPulse, 590 * blurScale * heightPulse, pose.angle * 0.12, [
    [0, `rgba(255, 250, 255, ${0.38 * lift})`],
    [0.16, `rgba(255, 174, 242, ${0.34 * lift})`],
    [0.38, `rgba(238, 48, 190, ${0.275 * lift})`],
    [0.66, `rgba(185, 26, 132, ${0.14 * lift})`],
    [0.84, `rgba(73, 185, 255, ${0.075 * lift})`],
    [1, "rgba(0, 0, 0, 0)"],
  ]);
}

function drawFlameDepth(ctx, pose, bodyY, blurScale, intensity) {
  const layers = [
    {
      x: pose.flameA * 34,
      y: bodyY * (0.7 + pose.flameB * 0.035),
      rx: 230 * pose.width,
      ry: 390 * pose.length,
      blur: 31,
      alpha: 0.16,
      tilt: -0.08 + pose.flameC * 0.03,
    },
    {
      x: -46 + pose.flameB * 28,
      y: bodyY * (0.96 + pose.flameC * 0.03),
      rx: 280 * pose.width,
      ry: 470 * pose.length,
      blur: 42,
      alpha: 0.11,
      tilt: 0.12 + pose.flameA * 0.035,
    },
    {
      x: 58 + pose.flameC * 30,
      y: bodyY * (1.13 + pose.flameA * 0.025),
      rx: 330 * pose.width,
      ry: 430 * pose.length,
      blur: 50,
      alpha: 0.085,
      tilt: -0.15 + pose.flameB * 0.03,
    },
  ];

  layers.forEach((layer) => {
    ctx.filter = `blur(${Math.round(layer.blur * blurScale)}px)`;
    drawEllipseGlow(ctx, layer.x, layer.y, layer.rx * blurScale, layer.ry * blurScale, layer.tilt, [
      [0, `rgba(255, 240, 253, ${layer.alpha * 0.95 * intensity})`],
      [0.18, `rgba(255, 139, 232, ${layer.alpha * 0.9 * intensity})`],
      [0.42, `rgba(222, 39, 179, ${layer.alpha * 0.72 * intensity})`],
      [0.7, `rgba(105, 10, 76, ${layer.alpha * 0.34 * intensity})`],
      [1, "rgba(0, 0, 0, 0)"],
    ]);
  });
}

function drawEllipseGlow(ctx, x, y, rx, ry, rotation, stops) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.scale(rx, ry);
  const gradient = ctx.createRadialGradient(0, 0, 0.02, 0, 0, 1);
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTerminalBase(ctx) {
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
}

function drawTerminalOverlay(ctx) {
  const bottom = ctx.createLinearGradient(0, 870, 0, H);
  bottom.addColorStop(0, "rgba(0,0,0,0)");
  bottom.addColorStop(1, "rgba(26,26,31,0.92)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, 830, W, 194);

  ctx.fillStyle = "#f6f6f9";
  ctx.textAlign = "center";
  ctx.font = `550 28px ${UI_FONT}`;
  ctx.fillText("Поднесите QR-код заказа", W / 2, 82);
  ctx.fillText("к камере терминала", W / 2, 118);

  ctx.fillStyle = "rgba(246, 246, 249, 0.78)";
  ctx.font = `400 16px ${GOOGLE_FONT}`;
  ctx.fillText("QR-код заказа находится на главном экране", W / 2, 160);
  ctx.fillText("приложения Wildberries или в разделе «Заказы»", W / 2, 181);

  roundRect(ctx, 484, 792, 312, 104, 32);
  ctx.fillStyle = "#242429";
  ctx.fill();
  ctx.fillStyle = "#f6f6f9";
  ctx.font = `500 28px ${GOOGLE_FONT}`;
  ctx.fillText("Отмена", W / 2, 857);

  ctx.fillStyle = "#5f5f6d";
  ctx.font = `400 17px ${GOOGLE_FONT}`;
  ctx.fillText("Поддержка +7 987 654-32-10 · Терминал 3392", W / 2, 994);
}

function drawPreviewQr(ctx, progress) {
  if (!qrImage.complete || progress <= 0) return;

  const eased = easeOutCubic(progress);
  const size = QR_SIZE * (0.92 + eased * 0.08);
  const x = W / 2 - size / 2;
  const y = 512 - size / 2;
  const maskedQr = makeQrFadeCanvas(size);

  ctx.save();
  ctx.globalAlpha = eased * 0.8;
  ctx.drawImage(maskedQr, x, y);
  ctx.restore();

  drawQrHighlights(ctx, x, y, size, eased);
}

function makeQrFadeCanvas(size) {
  const drawSize = Math.ceil(size);
  qrDrawCanvas.width = drawSize;
  qrDrawCanvas.height = drawSize;
  qrDraw.clearRect(0, 0, drawSize, drawSize);
  qrDraw.drawImage(qrImage, 0, 0, drawSize, drawSize);
  qrDraw.globalCompositeOperation = "destination-in";

  const fade = qrDraw.createLinearGradient(0, drawSize * 0.22, 0, drawSize * 0.86);
  fade.addColorStop(0, "rgba(255, 255, 255, 1)");
  fade.addColorStop(0.32, "rgba(255, 255, 255, 0.92)");
  fade.addColorStop(0.56, "rgba(255, 255, 255, 0.42)");
  fade.addColorStop(0.72, "rgba(255, 255, 255, 0.12)");
  fade.addColorStop(1, "rgba(255, 255, 255, 0)");
  qrDraw.fillStyle = fade;
  qrDraw.fillRect(0, 0, drawSize, drawSize);
  qrDraw.globalCompositeOperation = "source-over";
  return qrDrawCanvas;
}

function drawQrHighlights(ctx, x, y, size, alpha) {
  if (!qrMask) return;

  const maskSize = Math.ceil(size);
  qrMaskCanvas.width = maskSize;
  qrMaskCanvas.height = maskSize;
  qrMask.clearRect(0, 0, maskSize, maskSize);
  qrMask.drawImage(makeQrFadeCanvas(size), 0, 0, maskSize, maskSize);
  qrMask.globalCompositeOperation = "source-in";

  let gradient = qrMask.createLinearGradient(maskSize * 0.32, 0, maskSize * 0.5, maskSize);
  gradient.addColorStop(0, `rgba(255, 255, 255, ${0.5 * alpha})`);
  gradient.addColorStop(0.22, `rgba(255, 230, 252, ${0.34 * alpha})`);
  gradient.addColorStop(0.48, `rgba(255, 145, 231, ${0.09 * alpha})`);
  gradient.addColorStop(0.76, `rgba(255, 145, 231, ${0.015 * alpha})`);
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  qrMask.fillStyle = gradient;
  qrMask.fillRect(0, 0, maskSize, maskSize);

  gradient = qrMask.createRadialGradient(maskSize * 0.5, maskSize * 0.12, 0, maskSize * 0.5, maskSize * 0.12, maskSize * 0.52);
  gradient.addColorStop(0, `rgba(255, 255, 255, ${0.34 * alpha})`);
  gradient.addColorStop(0.34, `rgba(255, 210, 248, ${0.16 * alpha})`);
  gradient.addColorStop(0.72, `rgba(238, 63, 193, ${0.035 * alpha})`);
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  qrMask.fillStyle = gradient;
  qrMask.fillRect(0, 0, maskSize, maskSize);

  const reveal = easeOutCubic(alpha);
  const bandY = maskSize * (0.08 + reveal * 0.46);
  gradient = qrMask.createLinearGradient(0, bandY - maskSize * 0.16, 0, bandY + maskSize * 0.19);
  gradient.addColorStop(0, "rgba(255, 255, 255, 0)");
  gradient.addColorStop(0.42, `rgba(255, 255, 255, ${0.3 * (1 - alpha * 0.18)})`);
  gradient.addColorStop(0.58, `rgba(255, 186, 240, ${0.18 * (1 - alpha * 0.12)})`);
  gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
  qrMask.fillStyle = gradient;
  qrMask.fillRect(0, 0, maskSize, maskSize);
  qrMask.globalCompositeOperation = "source-over";

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(qrMaskCanvas, x, y);
  ctx.restore();
}

function previewProgressAt(timeSeconds) {
  if (!previewActive) return 0;
  return clamp((timeSeconds - previewStartedAt) / 3, 0, 1);
}

function previewAngleAt(progress, startAngle = previewStartAngle) {
  return startAngle * (1 - easeOutCubic(clamp(progress / 0.42, 0, 1)));
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - clamp(value, 0, 1), 3);
}

function lerp(from, to, amount) {
  return from + (to - from) * amount;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function render(timeSeconds, target = screen, forcedPreview = null, forcedOptions = null) {
  const options = forcedOptions ?? settings();
  const isPreview = forcedPreview?.active ?? previewActive;
  const previewProgress = forcedPreview?.progress ?? previewProgressAt(timeSeconds);
  const startAngle = forcedPreview?.startAngle ?? previewStartAngle;
  drawTerminalBase(target);
  if (isPreview) {
    drawGlowLayer(glow, timeSeconds, options, previewAngleAt(previewProgress, startAngle), previewProgress);
  } else {
    drawGlowLayer(glow, timeSeconds, options);
  }
  target.drawImage(glowCanvas, 0, 0);
  drawPreviewQr(target, previewProgress);
  drawTerminalOverlay(target);
}

function tick(now) {
  const timeSeconds = playing ? (now - startedAt) / 1000 : (pausedAt - startedAt) / 1000;
  render(timeSeconds);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

playToggle.addEventListener("click", () => {
  playing = !playing;
  playToggle.textContent = playing ? "Пауза" : "Пуск";
  if (playing) {
    startedAt += performance.now() - pausedAt;
  } else {
    pausedAt = performance.now();
  }
});

previewToggle.addEventListener("click", () => {
  const time = currentTimeSeconds();
  if (!previewActive) {
    previewStartAngle = scanPose(time, settings()).angle;
  }
  previewActive = !previewActive;
  previewToggle.classList.toggle("is-active", previewActive);
  previewStartedAt = time;
});

function currentTimeSeconds() {
  return playing ? (performance.now() - startedAt) / 1000 : (pausedAt - startedAt) / 1000;
}

async function exportCanvas(kind) {
  if (!canRecordVideo()) {
    statusLine.textContent = "Этот браузер не поддерживает запись WebM. Откройте страницу в Chrome или Edge.";
    return;
  }

  const fps = 30;
  const exportSettings = settings();
  const seconds = clamp(exportSettings.duration, 1, 20);
  const exportPreviewActive = false;
  const exportPreviewStartAngle = 0;
  const exportCanvasEl = document.createElement("canvas");
  exportCanvasEl.width = W;
  exportCanvasEl.height = H;
  const ctx = exportCanvasEl.getContext("2d", { alpha: kind === "glow" });
  const stream = exportCanvasEl.captureStream(fps);
  const mimeType = pickMimeType();
  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 10_000_000 });

  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };

  const done = new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
  });

  setBusy(
    true,
    kind === "glow"
      ? `Записываю зацикленное свечение ${seconds.toFixed(1)} сек, 30 fps...`
      : `Записываю зацикленный экран ${seconds.toFixed(1)} сек, 30 fps...`
  );
  recorder.start();

  const totalFrames = Math.round(seconds * fps);
  const frameDuration = 1000 / fps;
  const recordingStartedAt = performance.now();

  for (let frame = 0; frame < totalFrames; frame += 1) {
    const t = (frame / totalFrames) * exportSettings.duration;
    const exportPreview = exportPreviewActive
      ? { active: true, progress: clamp(t / 3, 0, 1), startAngle: exportPreviewStartAngle }
      : { active: false, progress: 0, startAngle: 0 };
    if (kind === "glow") {
      if (exportPreview.active) {
        drawGlowLayer(ctx, t, exportSettings, previewAngleAt(exportPreview.progress, exportPreview.startAngle), exportPreview.progress);
      } else {
        drawGlowLayer(ctx, t, exportSettings);
      }
    } else {
      render(t, ctx, exportPreview, exportSettings);
    }
    await wait(Math.max(0, recordingStartedAt + (frame + 1) * frameDuration - performance.now()));
  }

  await wait(Math.max(0, recordingStartedAt + seconds * 1000 - performance.now()));
  recorder.stop();
  const blob = await done;
  downloadBlob(blob, kind === "glow" ? "terminal-glow.webm" : "terminal-screen.webm");
  setBusy(false, "Экспорт готов.");
}

function exportGlowStill() {
  const time = currentTimeSeconds();
  if (previewActive) {
    const progress = previewProgressAt(time);
    drawGlowLayer(glow, time, settings(), previewAngleAt(progress), progress);
  } else {
    drawGlowLayer(glow, time, settings());
  }
  glowCanvas.toBlob((blob) => {
    downloadBlob(blob, "terminal-glow.webp");
    statusLine.textContent = "WEBP-кадр свечения готов.";
  }, "image/webp", 0.96);
}

function ensureQrReady() {
  if (qrImage.complete) return Promise.resolve();
  return new Promise((resolve) => {
    qrImage.addEventListener("load", resolve, { once: true });
    qrImage.addEventListener("error", resolve, { once: true });
  });
}

function canRecordVideo() {
  return typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function";
}

function pickMimeType() {
  const types = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "video/webm";
}

function downloadBlob(blob, name) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function setBusy(isBusy, message) {
  [exportScreen, exportGlow, exportGlowWebp].forEach((button) => {
    button.disabled = isBusy;
  });
  statusLine.textContent = message;
}

exportScreen.addEventListener("click", () => exportCanvas("screen"));
exportGlow.addEventListener("click", () => exportCanvas("glow"));
exportGlowWebp.addEventListener("click", exportGlowStill);
