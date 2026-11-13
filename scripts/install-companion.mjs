import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
if (process.platform !== "darwin")
  throw new Error(
    "Automatic startup currently supports macOS only. Run pnpm start manually on other systems.",
  );
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const label = "com.nordstone.upwork-companion";
const plist = resolve(homedir(), "Library/LaunchAgents", label + ".plist");
const escape = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
await mkdir(dirname(plist), { recursive: true });
await mkdir(resolve(root, "data"), { recursive: true });
await writeFile(
  plist,
  `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>Label</key><string>${label}</string><key>ProgramArguments</key><array><string>${escape(process.execPath)}</string><string>${escape(resolve(root, "node_modules/next/dist/bin/next"))}</string><string>start</string><string>--hostname</string><string>127.0.0.1</string><string>--port</string><string>8765</string></array><key>WorkingDirectory</key><string>${escape(root)}</string><key>EnvironmentVariables</key><dict><key>NODE_ENV</key><string>production</string></dict><key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer><key>StandardOutPath</key><string>${escape(resolve(root, "data/companion.log"))}</string><key>StandardErrorPath</key><string>${escape(resolve(root, "data/companion-error.log"))}</string></dict></plist>`,
  { mode: 0o600 },
);
const domain = `gui/${process.getuid()}`;
spawnSync("launchctl", ["bootout", `${domain}/${label}`], { stdio: "ignore" });
const result = spawnSync("launchctl", ["bootstrap", domain, plist], {
  stdio: "inherit",
});
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(
  "Companion starts automatically when you log in and restarts if it exits. Open http://127.0.0.1:8765/companion",
);
