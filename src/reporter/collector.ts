/**
 * @fileoverview Failure Collector Reporter.
 * Captures detailed information about test failures, including screenshots, traces, and network logs.
 */
import fs from 'fs';
import path from 'path';
import type {
  Reporter,
  TestCase,
  TestResult,
  TestStep,
  FullConfig,
  Suite,
} from '@playwright/test/reporter';

/**
 * Represents a single network request captured during a test.
 */
interface NetworkEntry {
  url: string;
  method: string;
  status: number;
  duration: number;
  timestamp: string;
}

/**
 * Detailed context for a test failure.
 */
interface FailureContext {
  id: number;
  timestamp: string;
  test: string;
  file: string;
  duration: number;
  browser: string;
  error: string;
  steps: string[];
  network: NetworkEntry[];
  screenshotPath?: string;
  tracePath?: string;
}

const STORAGE_DIR = path.resolve(__dirname, '../../storage');
const FAILURES_DIR = path.join(STORAGE_DIR, 'failures');
const CONTEXT_FILE = path.join(STORAGE_DIR, 'context.md');

/**
 * Custom Playwright Reporter that collects detailed failure data for AI analysis.
 */
export class FailureCollector implements Reporter {
  private failureCount = 0;
  private runId: string;

  /**
   * Initializes a new instance of FailureCollector with a unique run ID.
   */
  constructor() {
    this.runId = `run-${Date.now()}`;
  }

  /**
   * Called when the test run begins. Ensures the storage directories exist.
   * @param _config The full Playwright configuration.
   * @param _suite The root suite of tests.
   */
  onBegin(_config: FullConfig, _suite: Suite): void {
    fs.mkdirSync(path.join(FAILURES_DIR, this.runId), { recursive: true });

    if (!fs.existsSync(CONTEXT_FILE)) {
      fs.writeFileSync(
        CONTEXT_FILE,
        `# Playwright Intelligence — Failure Context\n\nGerado automaticamente. Não edite manualmente.\n\n---\n\n`
      );
    }
  }

  /**
   * Called when a test case ends. Collects data if the test failed or timed out.
   * @param test The test case metadata.
   * @param result The result of the test execution.
   */
  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status !== 'failed' && result.status !== 'timedOut') return;

    this.failureCount++;
    const ctx = this.buildContext(test, result);
    this.persistMarkdown(ctx);
    this.persistScreenshot(result, ctx.id);
    this.persistTrace(result, ctx.id);
  }

  /**
   * Builds a structured FailureContext object from test data.
   * @private
   */
  private buildContext(test: TestCase, result: TestResult): FailureContext {
    const steps = result.steps.map((s: TestStep) => {
      const icon = s.error ? '❌' : '✅';
      return `${icon} ${s.title}${s.error ? ` — ${s.error.message?.split('\n')[0]}` : ''}`;
    });

    const network: NetworkEntry[] = (result as any).attachments
      ?.filter((a: any) => a.name === 'network')
      .map((a: any) => JSON.parse(a.body?.toString() ?? '{}'))
      .flat() ?? [];

    return {
      id: this.failureCount,
      timestamp: new Date().toISOString(),
      test: test.titlePath().join(' › '),
      file: `${test.location.file}:${test.location.line}`,
      duration: result.duration / 1000,
      browser: test.parent?.project()?.name ?? 'unknown',
      error: result.error?.message?.split('\n').slice(0, 3).join('\n') ?? 'Unknown error',
      steps,
      network: network.slice(-5), // últimas 5 requests
    };
  }

  /**
   * Appends the failure context to the context.md file in Markdown format.
   * @private
   */
  private persistMarkdown(ctx: FailureContext): void {
    const networkSection = ctx.network.length
      ? ctx.network
          .map((n) => `- \`${n.method}\` ${n.url} → **${n.status}** (${n.duration}ms)`)
          .join('\n')
      : '_Nenhuma request capturada_';

    const stepsSection = ctx.steps.length
      ? ctx.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
      : '_Nenhum step registrado_';

    const block = `
## FAILURE #${ctx.id} — ${ctx.timestamp}
**Test:** ${ctx.test}
**File:** \`${ctx.file}\`
**Duration:** ${ctx.duration.toFixed(1)}s | **Browser:** ${ctx.browser}
**Run:** \`${this.runId}\`

### Error
\`\`\`
${ctx.error}
\`\`\`

### Steps executados
${stepsSection}

### Network (últimas requests)
${networkSection}

${ctx.screenshotPath ? `### Screenshot\n![failure-${ctx.id}](${ctx.screenshotPath})\n` : ''}
---

`;

    fs.appendFileSync(CONTEXT_FILE, block);
  }

  /**
   * Saves the test screenshot to the failures directory.
   * @private
   */
  private persistScreenshot(result: TestResult, id: number): void {
    const screenshot = result.attachments.find(
      (a) => a.name === 'screenshot' && a.contentType === 'image/png'
    );

    if (screenshot?.path) {
      const dest = path.join(FAILURES_DIR, this.runId, `failure-${id}.png`);
      fs.copyFileSync(screenshot.path, dest);
    }
  }

  /**
   * Saves the Playwright execution trace to the failures directory.
   * @private
   */
  private persistTrace(result: TestResult, id: number): void {
    const trace = result.attachments.find(
      (a) => a.name === 'trace' && a.contentType === 'application/zip'
    );

    if (trace?.path) {
      const dest = path.join(FAILURES_DIR, this.runId, `trace-${id}.zip`);
      fs.copyFileSync(trace.path, dest);
    }
  }

  /**
   * Called when all tests have finished. Logs a summary to the console.
   */
  onEnd(): void {
    if (this.failureCount > 0) {
      console.log(`\n🔴 [PWI] ${this.failureCount} falha(s) coletada(s) em ${CONTEXT_FILE}`);
    }
  }
}
