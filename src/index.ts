/**
 * Playwright Intelligence - Main entry point
 * Exporte todos os componentes publicados
 */

export { PlaywrightIntelligence } from './reporter';
export { FailureCollector } from './reporter/collector';
export { SystemMapper } from './reporter/mapper';
export { AIProviderFactory, OllamaProvider, AnthropicProvider, OpenAIProvider } from './analyzer/ai-client';
export type { AIProvider, AIConfig } from './analyzer/ai-client';
export { PROMPTS } from './analyzer/prompts';
export { config, validateConfig, printConfig } from './config';

export default null;
