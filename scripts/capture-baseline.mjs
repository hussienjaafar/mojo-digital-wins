#!/usr/bin/env node
/**
 * Baseline Metrics Capture Script
 *
 * Captures Lighthouse, accessibility, and bundle metrics for the client dashboard.
 * Run with: npm run baseline
 *
 * Prerequisites:
 * - npm install -D lighthouse @axe-core/cli
 * - Dev server NOT running (script starts its own)
 */

import { spawn, execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const REPORTS_DIR = join(ROOT_DIR, 'reports');

const BASE_URL = 'http://localhost:5173';
const PAGES = [
  { name: 'dashboard', path: '/client/dashboard' },
  { name: 'alerts', path: '/client/alerts' },
  { name: 'journey', path: '/client/journey' },
];

// Ensure reports directory exists
if (!existsSync(REPORTS_DIR)) {
  mkdirSync(REPORTS_DIR, { recursive: true });
}

console.log('🚀 Starting Baseline Metrics Capture\n');
console.log('=' .repeat(50));

// Step 1: Build and capture bundle size
console.log('\n📦 Step 1: Capturing bundle analysis...\n');
try {
  const buildOutput = execSync('npm run build 2>&1', {
    cwd: ROOT_DIR,
    encoding: 'utf-8',
    maxBuffer: 10 * 1024 * 1024
  });
  writeFileSync(join(REPORTS_DIR, 'baseline-bundle.txt'), buildOutput);
  console.log('✅ Bundle analysis saved to reports/baseline-bundle.txt');

  // Extract key metrics from build output
  const chunkMatches = buildOutput.match(/dist\/assets\/[\w.-]+\s+[\d.]+\s+[kK][bB]/g) || [];
  console.log(`   Found ${chunkMatches.length} chunks in build output`);
} catch (error) {
  console.error('❌ Build failed:', error.message);
  writeFileSync(join(REPORTS_DIR, 'baseline-bundle.txt'), `Build failed: ${error.message}`);
}

// Step 2: Start dev server
console.log('\n🌐 Step 2: Starting dev server...\n');
const devServer = spawn('npm', ['run', 'dev'], {
  cwd: ROOT_DIR,
  shell: true,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let serverOutput = '';
devServer.stdout?.on('data', (data) => {
  serverOutput += data.toString();
});
devServer.stderr?.on('data', (data) => {
  serverOutput += data.toString();
});

// Wait for server to start
await new Promise((resolve) => {
  const checkServer = setInterval(async () => {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) {
        clearInterval(checkServer);
        console.log('✅ Dev server is running');
        resolve();
      }
    } catch {
      // Server not ready yet
    }
  }, 1000);

  // Timeout after 30 seconds
  setTimeout(() => {
    clearInterval(checkServer);
    console.log('⚠️  Server startup timeout - proceeding anyway');
    resolve();
  }, 30000);
});

// Give server a moment to stabilize
await new Promise(r => setTimeout(r, 2000));

// Step 3: Run Lighthouse on each page
console.log('\n🔦 Step 3: Running Lighthouse audits...\n');
const lighthouseResults = {};

for (const page of PAGES) {
  const url = `${BASE_URL}${page.path}`;
  const outputPath = join(REPORTS_DIR, `baseline-${page.name}.json`);

  console.log(`   Auditing ${page.name}...`);
  try {
    execSync(
      `npx lighthouse "${url}" --output=json --output-path="${outputPath}" --chrome-flags="--headless --no-sandbox --disable-gpu" --only-categories=performance,accessibility,best-practices,seo --quiet`,
      { cwd: ROOT_DIR, encoding: 'utf-8', timeout: 120000 }
    );

    // Read and parse results
    const results = JSON.parse(readFileSync(outputPath, 'utf-8'));
    lighthouseResults[page.name] = {
      performance: Math.round(results.categories.performance.score * 100),
      accessibility: Math.round(results.categories.accessibility.score * 100),
      bestPractices: Math.round(results.categories['best-practices'].score * 100),
      seo: Math.round(results.categories.seo.score * 100),
      lcp: results.audits['largest-contentful-paint']?.displayValue || 'N/A',
      tbt: results.audits['total-blocking-time']?.displayValue || 'N/A',
      cls: results.audits['cumulative-layout-shift']?.displayValue || 'N/A',
    };
    console.log(`   ✅ ${page.name}: Performance ${lighthouseResults[page.name].performance}, A11y ${lighthouseResults[page.name].accessibility}`);
  } catch (error) {
    console.error(`   ❌ ${page.name} failed:`, error.message?.substring(0, 100));
    lighthouseResults[page.name] = { error: error.message };
  }
}

// Step 4: Run axe accessibility check
console.log('\n♿ Step 4: Running axe accessibility audit...\n');
try {
  const axeOutput = execSync(
    `npx @axe-core/cli "${BASE_URL}/client/dashboard" --save "${join(REPORTS_DIR, 'baseline-a11y.json')}"`,
    { cwd: ROOT_DIR, encoding: 'utf-8', timeout: 60000 }
  );
  console.log('✅ Axe audit saved to reports/baseline-a11y.json');
} catch (error) {
  console.log('⚠️  Axe audit completed (may have violations):', error.message?.substring(0, 100));
}

// Step 5: Stop dev server
console.log('\n🛑 Step 5: Stopping dev server...\n');
devServer.kill('SIGTERM');
// On Windows, also try to kill the process tree
if (process.platform === 'win32') {
  try {
    execSync(`taskkill /pid ${devServer.pid} /T /F 2>nul`, { encoding: 'utf-8' });
  } catch { /* ignore */ }
}

// Step 6: Generate summary report
console.log('📝 Step 6: Generating summary report...\n');

const date = new Date().toISOString().split('T')[0];
const summary = `# Baseline Metrics - ${date}

## Lighthouse Scores

| Page | Performance | Accessibility | Best Practices | SEO | LCP | TBT | CLS |
|------|-------------|---------------|----------------|-----|-----|-----|-----|
${PAGES.map(page => {
  const r = lighthouseResults[page.name];
  if (r?.error) return `| ${page.name} | ❌ Error | - | - | - | - | - | - |`;
  return `| ${page.name} | ${r?.performance ?? '-'} | ${r?.accessibility ?? '-'} | ${r?.bestPractices ?? '-'} | ${r?.seo ?? '-'} | ${r?.lcp ?? '-'} | ${r?.tbt ?? '-'} | ${r?.cls ?? '-'} |`;
}).join('\n')}

## Targets (World-Class SaaS)

| Metric | Target | Status |
|--------|--------|--------|
| Performance Score | >= 90 | ${Object.values(lighthouseResults).every(r => r.performance >= 90) ? '✅' : '⚠️'} |
| Accessibility Score | >= 95 | ${Object.values(lighthouseResults).every(r => r.accessibility >= 95) ? '✅' : '⚠️'} |
| LCP | < 2.5s | Check individual pages |
| TBT | < 200ms | Check individual pages |
| CLS | < 0.1 | Check individual pages |

## Bundle Size

See \`reports/baseline-bundle.txt\` for full build output.

## Files Generated

- \`baseline-dashboard.json\` - Full Lighthouse report for dashboard
- \`baseline-alerts.json\` - Full Lighthouse report for alerts
- \`baseline-journey.json\` - Full Lighthouse report for journey
- \`baseline-a11y.json\` - Axe accessibility violations
- \`baseline-bundle.txt\` - Vite build output with chunk sizes

## Next Steps

1. Review any accessibility violations in \`baseline-a11y.json\`
2. Compare these baselines after optimization work
3. Set up CI to track regressions

---
*Generated by scripts/capture-baseline.mjs*
`;

writeFileSync(join(REPORTS_DIR, 'BASELINE_SUMMARY.md'), summary);
console.log('✅ Summary saved to reports/BASELINE_SUMMARY.md');

console.log('\n' + '='.repeat(50));
console.log('🎉 Baseline capture complete!\n');
console.log('Review results in the reports/ directory.');
