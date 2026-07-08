const http = require("http");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const crypto = require("crypto");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 4173);
const EXPORTS_DIR = path.join(ROOT, "exports");
const SESSIONS_DIR = path.join(EXPORTS_DIR, "frames");

fs.mkdirSync(EXPORTS_DIR, { recursive: true });
fs.mkdirSync(SESSIONS_DIR, { recursive: true });

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
};

const sessions = new Map();

const server = http.createServer(async (req, res) => {
  try {
    setCors(res);

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "POST" && req.url === "/api/export/start") {
      const body = await readJson(req);
      const id = crypto.randomUUID();
      const dir = path.join(SESSIONS_DIR, id);
      fs.mkdirSync(dir, { recursive: true });
      sessions.set(id, {
        dir,
        fps: clampNumber(body.fps, 1, 120),
        totalFrames: clampNumber(body.totalFrames, 1, 2000),
        width: clampNumber(body.width, 1, 8192),
        height: clampNumber(body.height, 1, 8192),
        name: String(body.name || "terminal-screen").replace(/[^a-z0-9-_]/gi, "-"),
      });
      sendJson(res, { id });
      return;
    }

    const frameMatch = req.url.match(/^\/api\/export\/([^/]+)\/frame\/(\d+)$/);
    if (req.method === "POST" && frameMatch) {
      const session = getSession(frameMatch[1]);
      const frame = Number(frameMatch[2]);
      const fileName = `frame-${String(frame).padStart(4, "0")}.png`;
      await writeBodyToFile(req, path.join(session.dir, fileName));
      sendJson(res, { ok: true });
      return;
    }

    const finishMatch = req.url.match(/^\/api\/export\/([^/]+)\/finish$/);
    if (req.method === "POST" && finishMatch) {
      const session = getSession(finishMatch[1]);
      const outputName = `${session.name}-${Date.now()}.mp4`;
      const outputPath = path.join(EXPORTS_DIR, outputName);
      await renderMp4(session, outputPath);
      sendJson(res, { url: `/exports/${outputName}`, fileName: outputName });
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error.message || "Server error");
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Export server: http://127.0.0.1:${PORT}/`);
});

function getSession(id) {
  const session = sessions.get(id);
  if (!session) throw new Error("Export session not found.");
  return session;
}

function renderMp4(session, outputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      "-y",
      "-framerate",
      String(session.fps),
      "-i",
      path.join(session.dir, "frame-%04d.png"),
      "-frames:v",
      String(session.totalFrames),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-crf",
      "12",
      "-preset",
      "slow",
      "-movflags",
      "+faststart",
      outputPath,
    ];
    const ffmpeg = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    ffmpeg.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `ffmpeg exited with code ${code}`));
    });
  });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const cleanPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(ROOT, cleanPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.writeHead(200, {
    "Content-Type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  fs.createReadStream(filePath).pipe(res);
}

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(res, data) {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return readBody(req).then((buffer) => JSON.parse(buffer.toString("utf8") || "{}"));
}

function writeBodyToFile(req, filePath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filePath);
    req.pipe(file);
    req.on("error", reject);
    file.on("error", reject);
    file.on("finish", resolve);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}
