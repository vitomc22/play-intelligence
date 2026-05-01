/**
 * @fileoverview Playwright Intelligence - Main entry point.
 * Re-exports all public components for easy access.
 * @module PlaywrightIntelligence
 */

// ── Reporter module exports ──
export { PlaywrightIntelligence } from './reporter';
export { FailureCollector } from './reporter/collector';
export { SystemMapper } from './reporter/mapper';

// ── Analyzer module exports ──
export { AIProviderFactory, OllamaProvider, AnthropicProvider, OpenAIProvider } from './analyzer/ai-client';
export type { AIProvider, AIConfig } from './analyzer/ai-client';
export { PROMPTS } from './analyzer/prompts';

// ── Configuration exports ──
export { config, validateConfig, printConfig } from './config';

export default null;
