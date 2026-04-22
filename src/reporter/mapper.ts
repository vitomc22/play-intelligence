import fs from 'fs';
import path from 'path';
import type {
  Reporter,
  TestCase,
  TestResult,
  TestStep,
  Suite,
  FullConfig,
} from '@playwright/test/reporter';

interface RouteEntry {
  route: string;
  selector: string | null;
  actions: string[];
  assertions: string[];
  testedBy: string[];
  lastSeen: string;
  failureCount: number;
  successCount: number;
}

interface SystemMap {
  updatedAt: string;
  totalRoutes: number;
  coverage: Record<string, CoverageEntry>;
  routes: Record<string, RouteEntry>;
}

interface CoverageEntry {
  score: number;
  actionCount: number;
  assertionCount: number;
  gaps: string[];
}

const STORAGE_DIR = path.resolve(__dirname, '../../storage');
const MAP_FILE = path.join(STORAGE_DIR, 'system-map.json');

const ACTION_KEYWORDS = ['click', 'fill', 'type', 'press', 'select', 'check', 'uncheck', 'hover', 'focus', 'goto', 'navigate'];
const ASSERTION_KEYWORDS = ['expect', 'toBeVisible', 'toHaveText', 'toHaveValue', 'toBeEnabled', 'toBeChecked', 'toContainText', 'toHaveURL'];
const COVERAGE_GAPS: Record<string, string[]> = {
  'validation': ['invalid input', 'empty state', 'required fields'],
  'error': ['404', 'timeout', 'network error', '500'],
  'auth': ['unauthorized', 'session expired'],
  'pagination': ['next page', 'previous page', 'last page'],
};

export class SystemMapper implements Reporter {
  private map: SystemMap;
  private currentRoute: Record<string, string> = {}; // testId → route

  constructor() {
    this.map = this.loadOrCreate();
  }

  onBegin(_config: FullConfig, _suite: Suite): void {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  onStepBegin(test: TestCase, _result: TestResult, step: TestStep): void {
    if (step.category !== 'pw:api') return;

    const route = this.extractRoute(step.title);
    if (route) {
      this.currentRoute[test.id] = route;
    }
  }

  onStepEnd(test: TestCase, _result: TestResult, step: TestStep): void {
    if (step.category !== 'pw:api') return;

    const route = this.currentRoute[test.id];
    if (!route) return;

    if (!this.map.routes[route]) {
      this.map.routes[route] = this.createRouteEntry(route, test);
    }

    const entry = this.map.routes[route];
    const action = this.extractAction(step.title);
    const assertion = this.extractAssertion(step.title);
    const selector = this.extractSelector(step.title);
    const testRef = `${path.basename(test.location.file)}:${test.location.line}`;

    if (action && !entry.actions.includes(action)) entry.actions.push(action);
    if (assertion && !entry.assertions.includes(assertion)) entry.assertions.push(assertion);
    if (selector && selector !== entry.selector) entry.selector = selector;
    if (!entry.testedBy.includes(testRef)) entry.testedBy.push(testRef);

    entry.lastSeen = new Date().toISOString();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    const route = this.currentRoute[test.id];
    if (!route || !this.map.routes[route]) return;

    const entry = this.map.routes[route];
    if (result.status === 'failed') {
      entry.failureCount++;
    } else if (result.status === 'passed') {
      entry.successCount++;
    }

    delete this.currentRoute[test.id];
  }

  onEnd(): void {
    this.map.updatedAt = new Date().toISOString();
    this.map.totalRoutes = Object.keys(this.map.routes).length;
    this.map.coverage = this.calculateCoverage();
    this.persist();

    const low = Object.entries(this.map.coverage)
      .filter(([, v]) => v.score < 60)
      .map(([r]) => r);

    if (low.length > 0) {
      console.log(`\n🗺️  [PWI] ${this.map.totalRoutes} rota(s) mapeada(s). Baixa cobertura: ${low.join(', ')}`);
    } else {
      console.log(`\n🗺️  [PWI] ${this.map.totalRoutes} rota(s) mapeada(s).`);
    }
  }

  // ─── helpers ───────────────────────────────────────────────

  private extractRoute(title: string): string | null {
    const match = title.match(/page\.goto.*?(\/[^\s"']+)/);
    return match ? match[1].split('?')[0] : null;
  }

  private extractAction(title: string): string | null {
    const found = ACTION_KEYWORDS.find((k) => title.toLowerCase().includes(k));
    return found ?? null;
  }

  private extractAssertion(title: string): string | null {
    const found = ASSERTION_KEYWORDS.find((k) => title.includes(k));
    return found ?? null;
  }

  private extractSelector(title: string): string | null {
    const patterns = [
      /getByRole\([^)]+\)/,
      /getByTestId\(['"]([^'"]+)['"]\)/,
      /locator\(['"]([^'"]+)['"]\)/,
      /getByText\(['"]([^'"]+)['"]\)/,
      /getByLabel\(['"]([^'"]+)['"]\)/,
    ];
    for (const p of patterns) {
      const m = title.match(p);
      if (m) return m[0];
    }
    return null;
  }

  private calculateCoverage(): Record<string, CoverageEntry> {
    const coverage: Record<string, CoverageEntry> = {};

    for (const [route, entry] of Object.entries(this.map.routes)) {
      const actionScore = Math.min(entry.actions.length * 10, 40);
      const assertionScore = Math.min(entry.assertions.length * 15, 45);
      const stabilityScore = entry.failureCount === 0 ? 15 : Math.max(0, 15 - entry.failureCount * 5);
      const score = Math.min(actionScore + assertionScore + stabilityScore, 100);

      const gaps: string[] = [];
      const combinedKeywords = [...entry.actions, ...entry.assertions].join(' ').toLowerCase();
      for (const [category, items] of Object.entries(COVERAGE_GAPS)) {
        if (!combinedKeywords.includes(category)) {
          gaps.push(...items);
        }
      }

      coverage[route] = {
        score,
        actionCount: entry.actions.length,
        assertionCount: entry.assertions.length,
        gaps: gaps.slice(0, 4),
      };
    }

    return coverage;
  }

  private createRouteEntry(route: string, test: TestCase): RouteEntry {
    return {
      route,
      selector: null,
      actions: [],
      assertions: [],
      testedBy: [],
      lastSeen: new Date().toISOString(),
      failureCount: 0,
      successCount: 0,
    };
  }

  private loadOrCreate(): SystemMap {
    if (fs.existsSync(MAP_FILE)) {
      return JSON.parse(fs.readFileSync(MAP_FILE, 'utf-8'));
    }
    return { updatedAt: '', totalRoutes: 0, coverage: {}, routes: {} };
  }

  private persist(): void {
    fs.writeFileSync(MAP_FILE, JSON.stringify(this.map, null, 2));
  }
}
