/**
 * @fileoverview Configuration module.
 * Loads and validates environment variables and provides a centralized config object.
 */
import * as dotenv from 'dotenv';

// Carrega .env
dotenv.config();

/**
 * Centralized configuration object for the entire application.
 */
export const config = {
  /**
   * AI Provider configuration.
   */
  ai: {
    provider: (process.env.AI_PROVIDER || 'ollama') as 'ollama' | 'anthropic' | 'openai',
    timeout: parseInt(process.env.AI_TIMEOUT_MS || '1800000', 10),
    temperature: parseFloat(process.env.AI_TEMPERATURE || '0.2'),
  },

  /**
   * Local Ollama configuration.
   */
  ollama: {
    url: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'gemma4:e2b',
  },

  /**
   * Anthropic provider configuration.
   */
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
  },

  /**
   * OpenAI provider configuration.
   */
  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
  },

  /**
   * File system paths for data storage and context.
   */
  paths: {
    storage: process.env.STORAGE_DIR || './storage',
    context: process.env.STORAGE_DIR ? `${process.env.STORAGE_DIR}/context.md` : './storage/context.md',
    systemMap: process.env.STORAGE_DIR
      ? `${process.env.STORAGE_DIR}/system-map.json`
      : './storage/system-map.json',
    cache: process.env.CACHE_DIR || './storage/cache',
  },

  /**
   * Logging configuration.
   */
  logging: {
    level: (process.env.LOG_LEVEL || 'info') as 'error' | 'warn' | 'info' | 'debug',
  },

  /**
   * Cache settings.
   */
  cache: {
    enabled: process.env.ENABLE_CACHE !== 'false',
  },
};

/**
 * Validates the current configuration against required parameters.
 * Exits the process if critical settings are missing or invalid.
 * @throws {Error} If validation fails (though currently it uses process.exit).
 */
export function validateConfig(): void {
  const errors: string[] = [];

  // Valida provider
  if (!['ollama', 'anthropic', 'openai'].includes(config.ai.provider)) {
    errors.push(`AI_PROVIDER inválido: ${config.ai.provider}`);
  }

  // Valida que pelo menos um provider está configurado
  if (
    config.ai.provider === 'ollama' &&
    !config.ollama.url
  ) {
    errors.push('OLLAMA_URL é obrigatório quando AI_PROVIDER=ollama');
  }

  if (config.ai.provider === 'anthropic' && !config.anthropic.apiKey) {
    errors.push('ANTHROPIC_API_KEY é obrigatório quando AI_PROVIDER=anthropic');
  }

  if (config.ai.provider === 'openai' && !config.openai.apiKey) {
    errors.push('OPENAI_API_KEY é obrigatório quando AI_PROVIDER=openai');
  }

  if (errors.length > 0) {
    console.error('❌ Erros de configuração:');
    errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  }
}

/**
 * Prints the active configuration to the console (excluding secrets).
 * Used for debugging and status checks.
 */
export function printConfig(): void {
  console.log('\n📋 Configuração Ativa:');
  console.log(`   Provider: ${config.ai.provider}`);
  console.log(`   Modelo: ${config.ai.provider === 'ollama' ? config.ollama.model : config.ai.provider
    }`);
  console.log(`   Timeout: ${config.ai.timeout}ms`);
  console.log(`   Temperatura: ${config.ai.temperature}`);
  console.log(`   Storage: ${config.paths.storage}\n`);
}
