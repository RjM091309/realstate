import { execSync } from 'node:child_process';

function usage() {
  console.log('Usage: node scripts/kill-ports.mjs <port...>');
}

function parseListeningPidsForPort(port) {
  const cmd = `netstat -ano | findstr ":${port} " | findstr "LISTENING"`;
  let out = '';
  try {
    out = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8', shell: true });
  } catch {
    return [];
  }
  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    const parts = s.split(/\s+/);
    const pid = parts[parts.length - 1];
    if (/^\d+$/.test(pid)) pids.add(pid);
  }
  return [...pids];
}

function killPid(pid) {
  try {
    execSync(`taskkill /PID ${pid} /F`, { stdio: 'inherit', shell: true });
    return true;
  } catch {
    return false;
  }
}

const ports = process.argv.slice(2).map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0);
if (ports.length === 0) {
  usage();
  process.exit(0);
}

const killed = new Set();
for (const port of ports) {
  const pids = parseListeningPidsForPort(port);
  if (pids.length === 0) {
    console.log(`[kill-ports] port ${port}: free`);
    continue;
  }
  console.log(`[kill-ports] port ${port}: killing ${pids.join(', ')}`);
  for (const pid of pids) {
    if (killed.has(pid)) continue;
    killPid(pid);
    killed.add(pid);
  }
}

