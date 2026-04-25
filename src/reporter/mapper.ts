/**
 * @fileoverview System Mapper Reporter.
 * Tracks visited routes, actions performed, and assertions made to build a system coverage map.
 */
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

/**
 * Represents metadata and coverage statistics for a specific application route.
 */
interface RouteEntry {
  /** The route path or URL. */
  route: string;
  /** The primary locator/selector used on this route. */
  selector: string | null;
  /** List of actions performed on this route (click, fill, etc.). */
  actions: string[];
  /** List of assertions performed on this route (toBeVisible, etc.). */
  assertions: string[];
  /** List of test files that cover this route. */
  testedBy: string[];
  /** ISO timestamp of the last time this route was exercised. */
  lastSeen: string;
  /** Number of times tests on this route have failed. */
  failureCount: number;
  /** Number of times tests on this route have passed. */
  successCount: number;
}

/**
 * The complete map of the system's tested surface area.
 */
interface SystemMap {
  updatedAt: string;
  totalRoutes: number;
  /** Coverage metrics keyed by route. */
  coverage: Record<string, CoverageEntry>;
  /** Detailed route data keyed by route path. */
  routes: Record<string, RouteEntry>;
}

/**
 * Coverage metrics for a specific route.
 */
interface CoverageEntry {
  /** Overall coverage score (0-100). */
  score: number;
  /** Total number of unique actions tested. */
  actionCount: number;
  /** Total number of unique assertions tested. */
  assertionCount: number;
  /** Identified gaps in testing for this route. */
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

/**
 * Custom Playwright Reporter that builds a system map and coverage report.
 */
export class SystemMapper implements Reporter {
  private map: SystemMap;
  /** Temporary storage to track the current route of each active test. */
  private currentRoute: Record<string, string> = {}; // testId → route

  /**
   * Initializes a new instance of SystemMapper and loads existing map data if available.
   */
  constructor() {
    this.map = this.loadOrCreate();
  }

  /**
   * Called when the test run begins.
   * @param _config The full Playwright configuration.
   * @param _suite The root suite of tests.
   */
  onBegin(_config: FullConfig, _suite: Suite): void {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }

  /**
   * Called when a test step begins. Used to detect navigation to new routes.
   * @param test The test case metadata.
   * @param _result The result of the test execution so far.
   * @param step The step that is starting.
   */
  onStepBegin(test: TestCase, _result: TestResult, step: TestStep): void {
    if (step.category !== 'pw:api') return;

    const route = this.extractRoute(step.title);
    if (route) {
      this.currentRoute[test.id] = route;
    }
  }

  /**
   * Called when a test step ends. Extracts actions, assertions, and selectors.
   * @param test The test case metadata.
   * @param _result The result of the test execution so far.
   * @param step The step that has finished.
   */
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

  /**
   * Called when a test case ends. Updates success/failure counts for the route.
   * @param test The test case metadata.
   * @param result The result of the test execution.
   */
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

  /**
   * Called when all tests have finished. Calculates final coverage and persists the map.
   */
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

  /**
   * Extracts a route or URL from a step title.
   * Handles page.goto and "Navigate to" step titles.
   * @private
   */
  private extractRoute(title: string): string | null {
    // Matches page.goto("/") or Navigate to "/"
    const match = title.match(/(?:page\.goto|Navigate to).*?(['"]?)([^\s"']+)\1/);
    if (match) {
      const url = match[2];
      try {
        if (url.startsWith('http')) {
          const u = new URL(url);
          // Return the full origin + path for external, or just path for local
          return u.pathname === '/' ? u.origin : u.origin + u.pathname;
        }
        return url.split('?')[0];
      } catch {
        return url.split('?')[0];
      }
    }
    return null;
  }

  /**
   * Extracts an action keyword from a step title.
   * @private
   */
  private extractAction(title: string): string | null {
    const found = ACTION_KEYWORDS.find((k) => title.toLowerCase().includes(k));
    return found ?? null;
  }

  /**
   * Extracts an assertion keyword from a step title.
   * @private
   */
  private extractAssertion(title: string): string | null {
    const found = ASSERTION_KEYWORDS.find((k) => title.includes(k));
    return found ?? null;
  }

  /**
   * Extracts a selector or locator from a step title.
   * @private
   */
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

  /**
   * Calculates coverage scores and identifies gaps for all routes in the map.
   * @private
   */
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

  /**
   * Creates a new, empty route entry.
   * @private
   */
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

  /**
   * Loads the existing system map from disk or creates a new one.
   * @private
   */
  private loadOrCreate(): SystemMap {
    if (fs.existsSync(MAP_FILE)) {
      return JSON.parse(fs.readFileSync(MAP_FILE, 'utf-8'));
    }
    return { updatedAt: '', totalRoutes: 0, coverage: {}, routes: {} };
  }

  /**
   * Persists the current system map to disk in JSON format.
   * @private
   */
  private persist(): void {
    fs.writeFileSync(MAP_FILE, JSON.stringify(this.map, null, 2));
  }
}
