const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..", "..");
const publicDir = path.resolve(__dirname, "..", "public");

const allowedExtensions = new Set([
  ".html",
  ".css",
  ".js",
  ".jpg",
  ".jpeg",
  ".png",
  ".svg",
  ".webp",
  ".ico",
  ".gif"
]);

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFrontendAssets() {
  ensureDir(publicDir);
  const entries = fs.readdirSync(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!allowedExtensions.has(ext)) continue;

    const sourcePath = path.join(rootDir, entry.name);
    const destPath = path.join(publicDir, entry.name);
    fs.copyFileSync(sourcePath, destPath);
  }
}

copyFrontendAssets();
console.log("Synced frontend assets to server/public");
