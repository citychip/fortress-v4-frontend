/**
 * FORTRESS V3 — Monitoring Router
 * Runs automated regression checks against the live VPS and returns
 * structured pass/fail results for each check category.
 */

import { publicProcedure, router } from "../_core/trpc";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

// ─── Types ────────────────────────────────────────────────────────────────────

export type CheckStatus = "pass" | "fail" | "warn" | "skip";

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  ms?: number;
}

export interface CheckCategory {
  id: string;
  label: string;
  checks: CheckResult[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const VPS_HOST = "76.13.138.194";
const VPS_PORT = 3000;
const VPS_BACKEND_PORT = 8080;
const VPS_BASE = `http://${VPS_HOST}:${VPS_PORT}`;
const VPS_API = `http://${VPS_HOST}:${VPS_BACKEND_PORT}`;
const SSH_KEY = "/home/ubuntu/.ssh/fortress_vps";
const SSH_USER = "root";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function httpGet(url: string, headers: Record<string, string> = {}, timeoutMs = 8000): Promise<{ ok: boolean; status: number; body: string; ms: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timer);
    const body = await res.text();
    return { ok: res.ok, status: res.status, body, ms: Date.now() - start };
  } catch (e: unknown) {
    return { ok: false, status: 0, body: String(e), ms: Date.now() - start };
  }
}

async function sshExec(cmd: string, timeoutMs = 10000): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  try {
    const { stdout, stderr } = await execFileAsync(
      "ssh",
      ["-i", SSH_KEY, "-o", "BatchMode=yes", "-o", "ConnectTimeout=8", `${SSH_USER}@${VPS_HOST}`, cmd],
      { timeout: timeoutMs }
    );
    return { stdout: stdout.trim(), stderr: stderr.trim(), ok: true };
  } catch (e: unknown) {
    return { stdout: "", stderr: String(e), ok: false };
  }
}

function pass(id: string, label: string, detail: string, ms?: number): CheckResult {
  return { id, label, status: "pass", detail, ms };
}
function fail(id: string, label: string, detail: string, ms?: number): CheckResult {
  return { id, label, status: "fail", detail, ms };
}
function warn(id: string, label: string, detail: string, ms?: number): CheckResult {
  return { id, label, status: "warn", detail, ms };
}

// ─── Check implementations ────────────────────────────────────────────────────

/** 1. Deployment — bundle sync, nginx serving correct file */
async function checkDeployment(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 1a. VPS is reachable
  const ping = await httpGet(`${VPS_BASE}/`);
  if (!ping.ok) {
    results.push(fail("deploy_reachable", "VPS reachable", `HTTP ${ping.status}: ${ping.body.slice(0, 100)}`, ping.ms));
    return results;
  }
  results.push(pass("deploy_reachable", "VPS reachable", `HTTP 200 in ${ping.ms}ms`, ping.ms));

  // 1b. index.html references a bundle
  const bundleMatch = ping.body.match(/index-([A-Za-z0-9_]+)\.js/);
  const vpsBundle = bundleMatch ? bundleMatch[0] : null;
  if (!vpsBundle) {
    results.push(fail("deploy_bundle_ref", "index.html references bundle", "No index-*.js found in HTML"));
    return results;
  }
  results.push(pass("deploy_bundle_ref", "index.html references bundle", vpsBundle));

  // 1c. Bundle file is actually served
  const bundleRes = await httpGet(`${VPS_BASE}/assets/${vpsBundle}`);
  if (!bundleRes.ok) {
    results.push(fail("deploy_bundle_served", "Bundle file served", `HTTP ${bundleRes.status}`));
  } else {
    results.push(pass("deploy_bundle_served", "Bundle file served", `${Math.round(bundleRes.body.length / 1024)}KB in ${bundleRes.ms}ms`, bundleRes.ms));
  }

  // 1d. Bundle contains key feature strings
  const bundleBody = bundleRes.body;
  const featureChecks: [string, string, string][] = [
    ["deploy_feat_sort", "Sort dropdown present", '"Sort:"'],
    ["deploy_feat_monitoring", "Monitoring row split present", '"monitoring"'],
    ["deploy_feat_quantdata", "QuantData Credentials section present", '"QuantData Credentials"'],
    ["deploy_feat_quantdata_url", "QuantData URL uses underscore", "quantdata_credentials"],
    ["deploy_feat_8nav", "8-tab nav routes present", '"/performance"'],
    ["deploy_feat_no_cockpits", "Cockpits section removed", "COCKPITS"],
    ["deploy_feat_scripts_card", "Scripts QuickNav card present", '"Scripts"'],
  ];

  for (const [id, label, needle] of featureChecks) {
    if (id === "deploy_feat_no_cockpits") {
      // This should NOT be present
      results.push(bundleBody.includes(needle)
        ? fail(id, label, `"${needle}" found — Cockpits section leaked back in`)
        : pass(id, label, "Not present in bundle ✓")
      );
    } else {
      results.push(bundleBody.includes(needle)
        ? pass(id, label, `"${needle}" found in bundle`)
        : fail(id, label, `"${needle}" missing from bundle`)
      );
    }
  }

  return results;
}

/** 2. Backend API — VPS Python server health */
async function checkBackend(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 2a. Backend health endpoint
  const health = await httpGet(`${VPS_API}/api/health`);
  if (health.ok) {
    try {
      const j = JSON.parse(health.body);
      results.push(pass("backend_health", "Backend health endpoint", `status: ${j.status ?? "ok"}, v${j.version ?? "?"}`, health.ms));
    } catch {
      results.push(pass("backend_health", "Backend health endpoint", `HTTP 200 in ${health.ms}ms`, health.ms));
    }
  } else {
    results.push(fail("backend_health", "Backend health endpoint", `HTTP ${health.status}: ${health.body.slice(0, 80)}`, health.ms));
  }

  // 2b. QuantData credentials status endpoint
  const qd = await httpGet(`${VPS_API}/api/settings/quantdata_credentials_status`);
  if (qd.status === 200 || qd.status === 401) {
    // 401 = endpoint exists but needs auth — that's fine
    try {
      const j = JSON.parse(qd.body);
      const hasToken = j.exists === true;
      results.push(hasToken
        ? pass("backend_quantdata_status", "QuantData credentials endpoint", `exists=true, preview: ${j.token_preview?.slice(0, 20) ?? "—"}`, qd.ms)
        : warn("backend_quantdata_status", "QuantData credentials endpoint", "Endpoint OK but no credentials stored yet", qd.ms)
      );
    } catch {
      results.push(pass("backend_quantdata_status", "QuantData credentials endpoint", `HTTP ${qd.status} (endpoint reachable)`, qd.ms));
    }
  } else {
    results.push(fail("backend_quantdata_status", "QuantData credentials endpoint", `HTTP ${qd.status}: ${qd.body.slice(0, 80)}`, qd.ms));
  }

  // 2c. Nginx proxy passes /api/ to backend
  const proxy = await httpGet(`${VPS_BASE}/api/health`);
  if (proxy.ok || proxy.status === 401) {
    results.push(pass("backend_nginx_proxy", "Nginx proxies /api/ to backend", `HTTP ${proxy.status} via nginx`, proxy.ms));
  } else {
    results.push(fail("backend_nginx_proxy", "Nginx proxies /api/ to backend", `HTTP ${proxy.status}: ${proxy.body.slice(0, 80)}`, proxy.ms));
  }

  return results;
}

/** 3. Navigation — 8-tab structure */
async function checkNavigation(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const ping = await httpGet(`${VPS_BASE}/`);
  const bundleMatch = ping.body.match(/index-([A-Za-z0-9_]+)\.js/);
  const vpsBundle = bundleMatch ? bundleMatch[0] : null;

  if (!vpsBundle) {
    return [fail("nav_bundle", "Bundle available for nav check", "No bundle found")];
  }

  const bundleRes = await httpGet(`${VPS_BASE}/assets/${vpsBundle}`);
  const b = bundleRes.body;

  const navChecks: [string, string, string, boolean][] = [
    ["nav_trade",       "Trade route (/trade)",           '"/trade"',       true],
    ["nav_performance", "Performance route (/performance)",'"/performance"', true],
    ["nav_config",      "Config route (/config)",         '"/config"',      true],
    ["nav_market_intel","Market Intel route",             '"/market-intel"',true],
    ["nav_positions",   "Positions route",                '"/positions"',   true],
    ["nav_analysis",    "Analysis route",                 '"/analysis"',    true],
    ["nav_earnings",    "Earnings route",                 '"/earnings"',    true],
    ["nav_no_cockpits", "No Cockpits section",            "COCKPITS",       false],
    ["nav_no_action_center","No Action Center",           "ActionCenter",   false],
  ];

  for (const [id, label, needle, shouldExist] of navChecks) {
    const found = b.includes(needle);
    if (shouldExist) {
      results.push(found ? pass(id, label, `"${needle}" in bundle`) : fail(id, label, `"${needle}" missing`));
    } else {
      results.push(found ? fail(id, label, `"${needle}" found — should be removed`) : pass(id, label, "Correctly absent from bundle"));
    }
  }

  return results;
}

/** 4. Features — specific sprint features */
async function checkFeatures(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const ping = await httpGet(`${VPS_BASE}/`);
  const bundleMatch = ping.body.match(/index-([A-Za-z0-9_]+)\.js/);
  const vpsBundle = bundleMatch ? bundleMatch[0] : null;

  if (!vpsBundle) {
    return [fail("feat_bundle", "Bundle available for feature check", "No bundle found")];
  }

  const bundleRes = await httpGet(`${VPS_BASE}/assets/${vpsBundle}`);
  const b = bundleRes.body;

  // Sprint v7.x features
  results.push(b.includes('"Sort:"')
    ? pass("feat_sort_label", "Market Intel: Sort label", '"Sort:" present')
    : fail("feat_sort_label", "Market Intel: Sort label", '"Sort:" missing'));

  results.push((b.includes('"default"') && b.includes('"alpha"'))
    ? pass("feat_sort_modes", "Market Intel: Sort modes (default/alpha)", 'Both "default" and "alpha" present')
    : fail("feat_sort_modes", "Market Intel: Sort modes (default/alpha)", 'One or both sort modes missing'));

  results.push(b.includes('"monitoring"')
    ? pass("feat_monitoring_split", "Candidates: Monitoring row split", '"monitoring" chip present')
    : fail("feat_monitoring_split", "Candidates: Monitoring row split", '"monitoring" missing'));

  // QuantData credentials
  results.push(b.includes('"QuantData Credentials"')
    ? pass("feat_quantdata_section", "Settings: QuantData Credentials section", 'Section title present')
    : fail("feat_quantdata_section", "Settings: QuantData Credentials section", 'Section missing'));

  results.push(b.includes('"Update Credentials"')
    ? pass("feat_quantdata_button", "Settings: Update Credentials button", 'Button text present')
    : fail("feat_quantdata_button", "Settings: Update Credentials button", 'Button missing'));

  results.push(!b.includes("quantdata-credentials") && b.includes("quantdata_credentials")
    ? pass("feat_quantdata_url", "Settings: QuantData URL uses underscore", 'Only underscore variant present')
    : fail("feat_quantdata_url", "Settings: QuantData URL uses underscore", 'Hyphen variant found or underscore missing'));

  // Null-safe toFixed
  results.push(b.includes("delta!=null") && b.includes("vega!=null")
    ? pass("feat_null_safe_greeks", "MorningBrief: Null-safe greeks.toFixed()", 'delta!=null and vega!=null guards present')
    : fail("feat_null_safe_greeks", "MorningBrief: Null-safe greeks.toFixed()", 'Null guards missing — crash risk'));

  results.push(b.includes("ivr!=null")
    ? pass("feat_null_safe_ivr", "MorningBrief: Null-safe ivr.toFixed()", 'ivr!=null guard present')
    : fail("feat_null_safe_ivr", "MorningBrief: Null-safe ivr.toFixed()", 'ivr null guard missing'));

  // Dashboard QuickNav
  results.push(b.includes('"Automation"') && b.includes('"/scripts"')
    ? pass("feat_quicknav_scripts", "Dashboard: Scripts QuickNav card", 'Scripts card with /scripts route present')
    : fail("feat_quicknav_scripts", "Dashboard: Scripts QuickNav card", 'Scripts card missing'));

  return results;
}

/** 5. Infrastructure — SSH, nginx, process health */
async function checkInfrastructure(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // 5a. SSH connectivity
  const sshTest = await sshExec("echo ok");
  results.push(sshTest.ok && sshTest.stdout === "ok"
    ? pass("infra_ssh", "SSH connectivity (root@VPS)", "BatchMode key auth working")
    : fail("infra_ssh", "SSH connectivity (root@VPS)", sshTest.stderr.slice(0, 100))
  );

  if (!sshTest.ok) return results;

  // 5b. Nginx process running
  const nginx = await sshExec("systemctl is-active nginx 2>/dev/null || pgrep -x nginx > /dev/null && echo active || echo inactive");
  results.push(nginx.stdout.includes("active")
    ? pass("infra_nginx", "Nginx process running", "systemctl: active")
    : fail("infra_nginx", "Nginx process running", nginx.stdout || "not active")
  );

  // 5c. Backend process running on port 8080
  const backend = await sshExec("ss -tlnp 2>/dev/null | grep ':8080' | head -1");
  results.push(backend.stdout.includes("8080")
    ? pass("infra_backend_port", "Backend listening on :8080", backend.stdout.slice(0, 80))
    : fail("infra_backend_port", "Backend listening on :8080", "Nothing on port 8080")
  );

  // 5d. Static files at correct path
  const staticCheck = await sshExec("ls /var/www/fortress-v2/index.html 2>/dev/null && echo exists || echo missing");
  results.push(staticCheck.stdout.includes("exists")
    ? pass("infra_static_path", "Static files at /var/www/fortress-v2/", "index.html present")
    : fail("infra_static_path", "Static files at /var/www/fortress-v2/", "index.html missing — wrong deploy target used")
  );

  // 5e. Disk space
  const disk = await sshExec("df -h / | awk 'NR==2{print $5\" used of \"$2}'");
  const usedPct = parseInt(disk.stdout);
  results.push(isNaN(usedPct) || usedPct < 85
    ? pass("infra_disk", "Disk space", disk.stdout || "OK")
    : warn("infra_disk", "Disk space", `${disk.stdout} — consider cleanup`)
  );

  return results;
}

// ─── Main procedure ───────────────────────────────────────────────────────────

export const monitoringRouter = router({
  runChecks: publicProcedure.query(async () => {
    const startedAt = new Date().toISOString();

    const [deployment, backend, navigation, features, infrastructure] = await Promise.all([
      checkDeployment(),
      checkBackend(),
      checkNavigation(),
      checkFeatures(),
      checkInfrastructure(),
    ]);

    const categories: CheckCategory[] = [
      { id: "deployment",     label: "Deployment",     checks: deployment },
      { id: "backend",        label: "Backend API",    checks: backend },
      { id: "navigation",     label: "Navigation",     checks: navigation },
      { id: "features",       label: "Sprint Features",checks: features },
      { id: "infrastructure", label: "Infrastructure", checks: infrastructure },
    ];

    const total   = categories.flatMap(c => c.checks).length;
    const passed  = categories.flatMap(c => c.checks).filter(c => c.status === "pass").length;
    const failed  = categories.flatMap(c => c.checks).filter(c => c.status === "fail").length;
    const warned  = categories.flatMap(c => c.checks).filter(c => c.status === "warn").length;

    return { categories, total, passed, failed, warned, startedAt };
  }),
});
