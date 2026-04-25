/**
 * @fileoverview Playwright Intelligence - Main entry point.
 * Re-exports all public components for easy access.
 * @module PlaywrightIntelligence
 */

export { PlaywrightIntelligence } from './reporter';
export { FailureCollector } from './reporter/collector';
export { SystemMapper } from './reporter/mapper';
export { AIProviderFactory, OllamaProvider, AnthropicProvider, OpenAIProvider } from './analyzer/ai-client';
export type { AIProvider, AIConfig } from './analyzer/ai-client';

/**
 * @fileoverview Prompt templates for AI analysis and suggestions.
 * These prompts define how the AI should interpret test failures and system maps.
 */
export { PROMPTS } from './analyzer/prompts';
export { config, validateConfig, printConfig } from './config';

export default null;
