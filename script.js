const screenCanvas = document.getElementById("screenCanvas");
const glowCanvas = document.getElementById("glowCanvas");
const screen = screenCanvas.getContext("2d");
const glow = glowCanvas.getContext("2d", { alpha: true });

const controls = {
  duration: document.getElementById("duration"),
  amplitude: document.getElementById("amplitude"),
  intensity: document.getElementById("intensity"),
  blur: document.getElementById("blur"),
  beamSize: document.getElementById("beamSize"),
  beamLength: document.getElementById("beamLength"),
  fps: document.getElementById("fps"),
  exportSeconds: document.getElementById("exportSeconds"),
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
const exportScreen = document.getElementById("exportScreen");
const exportGlow = document.getElementById("exportGlow");
const exportGlowWebp = document.getElementById("exportGlowWebp");
const statusLine = document.getElementById("status");

const W = 1280;
const H = 1024;
const UI_FONT = '"WB Sans Local", "WB Sans", Arial, sans-serif';
let playing = true;
let startedAt = performance.now();
let pausedAt = 0;

if ("fonts" in document) {
  document.fonts.load(`28px ${UI_FONT}`);
  document.fonts.load(`17px ${UI_FONT}`);
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

function scanPose(time, options) {
  const cycle = time / options.duration;
  const breathe = Math.sin(cycle * Math.PI * options.pulseSpeed);
  const blurBreath = Math.sin(cycle * Math.PI * (options.pulseSpeed * 0.62) + 1.2);
  const sizeBreath = Math.sin(cycle * Math.PI * 1.14 + 0.35);
  const lengthBreath = Math.sin(cycle * Math.PI * 0.86 + 1.7);
  const lookA = Math.sin(cycle * Math.PI * 2);
  const lookB = Math.sin(cycle * Math.PI * 3.34 + 0.9) * 0.26;
  const lookC = Math.sin(cycle * Math.PI * 1.12 - 0.4) * 0.16;
  const amp = options.amplitude;
  const look = (lookA + lookB + lookC) * amp * (0.5 + options.motionLife * 0.45);
  const dynamicScale = 0.5 + 0.5 * Math.sin(cycle * Math.PI * 2.18 - 0.5);
  const focus = 0.5 + 0.5 * Math.sin(cycle * Math.PI * 2.68 + 1.4);

  return {
    sourceX: W / 2,
    sourceY: -260,
    angle: -look * 0.28 + Math.sin(cycle * Math.PI * 1.65) * 0.035,
    width: options.beamSize * (1.22 + dynamicScale * 0.1 + sizeBreath * (0.035 + options.motionLife * 0.035)),
    length: options.beamLength * (0.96 + dynamicScale * 0.13 + lengthBreath * (0.055 + options.motionLife * 0.06)),
    pulse: 0.9 + breathe * options.pulseDepth + Math.sin(cycle * Math.PI * 1.35 + 0.5) * options.pulseDepth * 0.35,
    softness: 1.08 + blurBreath * options.blurPulse,
    focus: 0.94 + focus * 0.16,
  };
}

function drawGlowLayer(ctx, time, options) {
  const pose = scanPose(time, options);
  const intensity = options.intensity * pose.pulse;
  const blurScale = options.blur * pose.softness;
  const sourceX = pose.sourceX;
  const sourceY = pose.sourceY;

  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  ctx.translate(sourceX, sourceY);
  ctx.rotate(pose.angle);

  const bodyX = 0;
  const bodyY = 250 * pose.length;

  ctx.filter = `blur(${Math.round(24 * blurScale)}px)`;
  drawEllipseGlow(ctx, bodyX, bodyY, 520 * pose.width * blurScale, 620 * pose.length * blurScale, 0, [
    [0, `rgba(255, 232, 253, ${0.34 * intensity})`],
    [0.14, `rgba(251, 135, 225, ${0.31 * intensity})`],
    [0.31, `rgba(230, 49, 190, ${0.27 * intensity})`],
    [0.52, `rgba(156, 20, 112, ${0.17 * intensity})`],
    [0.72, `rgba(72, 7, 51, ${0.09 * intensity})`],
    [0.9, `rgba(20, 3, 15, ${0.035 * intensity})`],
    [1, "rgba(0, 0, 0, 0)"],
  ]);

  ctx.filter = `blur(${Math.round(17 * blurScale)}px)`;
  drawEllipseGlow(ctx, bodyX, bodyY * 0.88, 255 * pose.focus * blurScale, 330 * pose.length * blurScale, 0, [
    [0, `rgba(255, 252, 254, ${0.32 * intensity})`],
    [0.22, `rgba(255, 179, 239, ${0.27 * intensity})`],
    [0.52, `rgba(230, 48, 190, ${0.13 * intensity})`],
    [0.78, `rgba(115, 12, 82, ${0.05 * intensity})`],
    [1, "rgba(0, 0, 0, 0)"],
  ]);

  ctx.filter = `blur(${Math.round(54 * blurScale)}px)`;
  drawEllipseGlow(ctx, bodyX, bodyY * 1.25, 760 * pose.width * blurScale, 620 * pose.length * blurScale, 0, [
    [0, `rgba(220, 41, 178, ${0.14 * intensity})`],
    [0.34, `rgba(137, 15, 98, ${0.1 * intensity})`],
    [0.64, `rgba(54, 7, 38, ${0.055 * intensity})`],
    [0.86, `rgba(14, 2, 10, ${0.025 * intensity})`],
    [1, "rgba(0, 0, 0, 0)"],
  ]);
  ctx.filter = "none";

  ctx.restore();
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

  roundRect(ctx, 484, 792, 312, 104, 32);
  ctx.fillStyle = "#242429";
  ctx.fill();
  ctx.fillStyle = "#f6f6f9";
  ctx.font = `550 28px ${UI_FONT}`;
  ctx.fillText("Отмена", W / 2, 857);

  ctx.fillStyle = "#5f5f6d";
  ctx.font = `400 17px ${UI_FONT}`;
  ctx.fillText("Поддержка +7 987 654-32-10 · Терминал 3392", W / 2, 994);
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

function render(timeSeconds, target = screen) {
  const options = settings();
  drawTerminalBase(target);
  drawGlowLayer(glow, timeSeconds, options);
  target.drawImage(glowCanvas, 0, 0);
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

function currentTimeSeconds() {
  return playing ? (performance.now() - startedAt) / 1000 : (pausedAt - startedAt) / 1000;
}

async function exportCanvas(kind) {
  if (!canRecordVideo()) {
    statusLine.textContent = "Этот браузер не поддерживает запись WebM. Откройте страницу в Chrome или Edge.";
    return;
  }

  const fps = clamp(Number(controls.fps.value), 24, 60);
  const seconds = clamp(Number(controls.exportSeconds.value), 1, 20);
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

  setBusy(true, kind === "glow" ? "Записываю свечение..." : "Записываю экран...");
  recorder.start();

  const totalFrames = Math.round(seconds * fps);
  const frameDuration = 1000 / fps;
  const startTime = currentTimeSeconds();

  for (let frame = 0; frame < totalFrames; frame += 1) {
    const t = startTime + frame / fps;
    if (kind === "glow") {
      drawGlowLayer(ctx, t, settings());
    } else {
      render(t, ctx);
    }
    await wait(frameDuration);
  }

  recorder.stop();
  const blob = await done;
  downloadBlob(blob, kind === "glow" ? "terminal-glow.webm" : "terminal-screen.webm");
  setBusy(false, "Экспорт готов.");
}

function exportGlowStill() {
  drawGlowLayer(glow, currentTimeSeconds(), settings());
  glowCanvas.toBlob((blob) => {
    downloadBlob(blob, "terminal-glow.webp");
    statusLine.textContent = "WEBP-кадр свечения готов.";
  }, "image/webp", 0.96);
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
