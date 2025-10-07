// Safe auto-updater: add credentials: 'include' to client fetch calls
// Runs over components/ and app/ files that contain "use client" or live in components/

const fs = require("fs");
const path = require("path");
const glob = require("glob");

const repo = path.resolve(__dirname, "..");

function isClientFile(filePath, content) {
  if (filePath.includes(path.join("components", path.sep))) return true;
  return /"use client"|'use client'/.test(content);
}

function processFile(filePath) {
  let changed = false;
  let content = fs.readFileSync(filePath, "utf8");
  if (!content.includes("fetch(") || !content.includes("/api/")) return false;
  if (!isClientFile(filePath, content)) return false;

  // Replace fetch(url) -> fetch(url, { credentials: 'include' }) when no second arg
  const singleArgRegex = /fetch\(\s*(['"`][^'"`]*\/api\/[^'"`]*['"`])\s*\)/g;
  content = content.replace(singleArgRegex, (m, p1) => {
    changed = true;
    return `fetch(${p1}, { credentials: 'include' })`;
  });

  // Replace fetch(url, { ... }) where object doesn't contain credentials
  const optionsRegex =
    /fetch\(\s*(['"`][^'"`]*\/api\/[^'"`]*['"`])\s*,\s*\{([\s\S]*?)\}\s*\)/g;
  content = content.replace(optionsRegex, (m, p1, p2) => {
    const inner = p2;
    if (/credentials\s*:\s*/.test(inner)) return m;
    changed = true;
    // insert credentials at start of object properties
    // avoid duplicate commas
    const newInner = ` credentials: 'include',${inner}`;
    return `fetch(${p1}, {${newInner}})`;
  });

  if (changed) {
    fs.writeFileSync(filePath, content, "utf8");
    return true;
  }
  return false;
}

async function main() {
  const patterns = [
    path.join(repo, "components", "**", "*.{ts,tsx,js,jsx}"),
    path.join(repo, "app", "**", "*.{ts,tsx,js,jsx}"),
  ];

  const files = patterns.flatMap((p) => glob.sync(p, { nodir: true }));
  const changedFiles = [];
  for (const f of files) {
    try {
      if (processFile(f)) changedFiles.push(f.replace(repo + path.sep, ""));
    } catch (e) {
      console.error("Error processing", f, e);
    }
  }

  console.log("Done. Modified files:", changedFiles.length);
  for (const cf of changedFiles) console.log(" -", cf);
  if (changedFiles.length === 0) process.exit(0);
}

main();
