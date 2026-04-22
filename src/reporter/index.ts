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
 * Reporter combinado: roda Collector e Mapper em paralelo.
 * Adicione ao playwright.config.ts:
 *
 * reporter: [
 *   ['list'],
 *   ['./src/reporter/index.ts']
 * ]
 */
export class PlaywrightIntelligence implements Reporter {
  private reporters: Reporter[];

  constructor() {
    this.reporters = [new FailureCollector(), new SystemMapper()];
  }

  onBegin(config: FullConfig, suite: Suite): void {
    this.reporters.forEach((r) => r.onBegin?.(config, suite));
  }

  onTestBegin(test: TestCase, result: TestResult): void {
    this.reporters.forEach((r) => r.onTestBegin?.(test, result));
  }

  onStepBegin(test: TestCase, result: TestResult, step: TestStep): void {
    this.reporters.forEach((r) => r.onStepBegin?.(test, result, step));
  }

  onStepEnd(test: TestCase, result: TestResult, step: TestStep): void {
    this.reporters.forEach((r) => r.onStepEnd?.(test, result, step));
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    this.reporters.forEach((r) => r.onTestEnd?.(test, result));
  }

  async onEnd(result: FullResult): Promise<void> {
    for (const r of this.reporters) {
      await r.onEnd?.(result);
    }
  }
}

export default PlaywrightIntelligence;

