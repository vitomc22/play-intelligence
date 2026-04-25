/**
 * @fileoverview Combined Reporter Entry Point.
 * Orchestrates multiple sub-reporters (FailureCollector and SystemMapper) to run in parallel.
 */
import type {
  Reporter,
  TestCase,
  TestResult,
  TestStep,
  FullConfig,
  Suite,
  FullResult,
} from '@playwright/test/reporter';
import { FailureCollector } from './collector';
import { SystemMapper } from './mapper';

/**
 * Main Playwright Intelligence reporter.
 * Integrates directly with Playwright to collect context and map system coverage.
 * 
 * To use, add it to your `playwright.config.ts`:
 * @example
 * ```typescript
 * export default defineConfig({
 *   reporter: [
 *     ['list'],
 *     ['./src/reporter/index.ts']
 *   ]
 * });
 * ```
 */
export class PlaywrightIntelligence implements Reporter {
  private reporters: Reporter[];

  /**
   * Initializes the combined reporter with its internal sub-reporters.
   */
  constructor() {
    this.reporters = [new FailureCollector(), new SystemMapper()];
  }

  /**
   * Forwards onBegin event to all sub-reporters.
   */
  onBegin(config: FullConfig, suite: Suite): void {
    this.reporters.forEach((r) => r.onBegin?.(config, suite));
  }

  /**
   * Forwards onTestBegin event to all sub-reporters.
   */
  onTestBegin(test: TestCase, result: TestResult): void {
    this.reporters.forEach((r) => r.onTestBegin?.(test, result));
  }

  /**
   * Forwards onStepBegin event to all sub-reporters.
   */
  onStepBegin(test: TestCase, result: TestResult, step: TestStep): void {
    this.reporters.forEach((r) => r.onStepBegin?.(test, result, step));
  }

  /**
   * Forwards onStepEnd event to all sub-reporters.
   */
  onStepEnd(test: TestCase, result: TestResult, step: TestStep): void {
    this.reporters.forEach((r) => r.onStepEnd?.(test, result, step));
  }

  /**
   * Forwards onTestEnd event to all sub-reporters.
   */
  onTestEnd(test: TestCase, result: TestResult): void {
    this.reporters.forEach((r) => r.onTestEnd?.(test, result));
  }

  /**
   * Forwards onEnd event to all sub-reporters and waits for async completion.
   */
  async onEnd(result: FullResult): Promise<void> {
    for (const r of this.reporters) {
      await r.onEnd?.(result);
    }
  }
}

export default PlaywrightIntelligence;

