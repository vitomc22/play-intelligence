/**
 * @fileoverview AI Client Module.
 * Provides a unified interface for interacting with different AI providers (Ollama, Anthropic, OpenAI).
 */

/**
 * Interface for AI providers that can analyze text context.
 */
export interface AIProvider {
  /**
   * Analyzes a prompt within a given context.
   * @param prompt The instruction or question for the AI.
   * @param context The data context (e.g., test failures, logs).
   * @returns A promise that resolves to the AI's response string.
   */
  analyze(prompt: string, context: string): Promise<string>;
}

/**
 * Configuration options for AI providers.
 */
export interface AIConfig {
  /** The provider type to use. */
  provider: 'ollama' | 'anthropic' | 'openai';
  /** The specific model name (e.g., 'gemma4:e2b', 'gpt-4o-mini'). */
  model?: string;
  /** Base URL for local providers like Ollama. */
  baseUrl?: string;
  /** API key for cloud providers. */
  apiKey?: string;
  /** Timeout in milliseconds for the request. */
  timeout?: number;
  /** Temperature for response generation (0.0 to 1.0). */
  temperature?: number;
}

/**
 * Implementation of AIProvider for the local Ollama service.
 * Optimized for local execution on standard hardware (e.g., Ryzen 7).
 */
export class OllamaProvider implements AIProvider {
  private baseUrl: string;
  private model: string;
  private timeout: number;
  private temperature: number;

  /**
   * Creates an instance of OllamaProvider.
   * @param config Partial configuration override.
   */
  constructor(config: Partial<AIConfig> = {}) {
    this.model = config.model || process.env.OLLAMA_MODEL || 'gemma4:e2b';
    this.baseUrl = config.baseUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
    this.timeout = config.timeout || 1200000; // 20 min para Ryzen processar
    this.temperature = config.temperature ?? 0.2; // Baixo para respostas técnicas
  }

  /**
   * Sends a request to the Ollama chat API.
   * Includes a "thinking" system prompt for deeper analysis.
   */
  async analyze(prompt: string, context: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      console.log(`📡 Conectando ao Ollama (${this.model})...`);
      console.log(`⏱️  Timeout configurado: ${Math.floor(this.timeout / 1000 / 60)} minutos`);
      
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: true,
          messages: [
            {
              role: 'system',
              content:
                'Você é um especialista em Playwright. ' +
                'Responda em português, de forma técnica e objetiva.',
            },
            {
              role: 'user',
              content: `${prompt}\n\n---\n\n${context}`,
            },
          ],
          options: {
            temperature: this.temperature,
            num_ctx: 4096,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        clearTimeout(timeoutId);
        if (response.status === 404) {
          throw new Error(
            `Modelo '${this.model}' não encontrado. Execute: ollama pull ${this.model}`
          );
        }
        throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
      }

      console.log('⏳ Gerando resposta (streaming)...');
      
      const reader = response.body?.getReader();
      if (!reader) throw new Error('Não foi possível ler o stream da resposta');

      let fullContent = '';
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.message?.content) {
              fullContent += data.message.content;
              // Feedback visual de progresso (opcional)
              if (fullContent.length % 100 === 0) process.stdout.write('.');
            }
            if (data.done) break;
          } catch (e) {
            // Ignora chunks incompletos
          }
        }
      }

      clearTimeout(timeoutId);
      console.log('\n✅ Resposta completa recebida.');
      return fullContent;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Timeout após ${this.timeout}ms. A IA demorou demais para responder. Tente aumentar AI_TIMEOUT_MS no arquivo .env`);
      }
      if (error.cause?.code === 'ECONNREFUSED') {
        throw new Error(
          `Ollama não está rodando em ${this.baseUrl}. ` +
          `Inicie com: docker run -d -p 11434:11434 ollama/ollama`
        );
      }
      throw error;
    }
  }
}

/**
 * Implementation of AIProvider for the Anthropic Claude API.
 */
export class AnthropicProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  /**
   * Creates an instance of AnthropicProvider.
   * @param config Partial configuration override.
   * @throws {Error} If ANTHROPIC_API_KEY is missing.
   */
  constructor(config: Partial<AIConfig> = {}) {
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.model = config.model || 'claude-3-5-sonnet-20241022';

    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY não definida');
    }
  }

  /**
   * Sends a request to the Anthropic Messages API.
   */
  async analyze(prompt: string, context: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          {
            role: 'user',
            content: `${prompt}\n\n---\n\n${context}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    return data.content?.[0]?.text ?? '';
  }
}

/**
 * Implementation of AIProvider for the OpenAI GPT API.
 */
export class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private model: string;

  /**
   * Creates an instance of OpenAIProvider.
   * @param config Partial configuration override.
   * @throws {Error} If OPENAI_API_KEY is missing.
   */
  constructor(config: Partial<AIConfig> = {}) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.model = config.model || 'gpt-4o-mini';

    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY não definida');
    }
  }

  /**
   * Sends a request to the OpenAI Chat Completions API.
   */
  async analyze(prompt: string, context: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'Você é um especialista em qualidade de software e testes automatizados com Playwright. ' +
              'Analise os dados fornecidos e responda em português. ' +
              'Seja objetivo, técnico e forneça exemplos de código TypeScript quando relevante.',
          },
          {
            role: 'user',
            content: `${prompt}\n\n---\n\n${context}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as any;
    return data.choices?.[0]?.message?.content ?? '';
  }
}

/**
 * Factory class for creating AIProvider instances.
 * Manages provider selection and automatic fallback logic.
 */
export class AIProviderFactory {
  /**
   * Creates the appropriate provider based on configuration or environment variables.
   * Priority: Ollama (local) > Anthropic > OpenAI.
   * @param config Partial configuration override.
   * @returns An instance of AIProvider.
   */
  static create(config: Partial<AIConfig> = {}): AIProvider {
    const provider = (config.provider || process.env.AI_PROVIDER || 'ollama').toLowerCase();

    switch (provider) {
      case 'anthropic': {
        console.log('🤖 Usando Anthropic Claude (cloud)');
        return new AnthropicProvider(config);
      }

      case 'openai': {
        console.log('🤖 Usando OpenAI GPT (cloud)');
        return new OpenAIProvider(config);
      }

      case 'ollama':
      default: {
        console.log('🤖 Usando Ollama local (gratuito)');
        return new OllamaProvider(config);
      }
    }
  }

  /**
   * Creates a provider with automatic fallback if the primary one fails.
   * Useful for CI environments where local Ollama might be unavailable.
   * @param config Partial configuration override.
   * @returns A promise that resolves to a working AIProvider.
   * @throws {Error} If no providers are available or working.
   */
  static async createWithFallback(config: Partial<AIConfig> = {}): Promise<AIProvider> {
    const primaryProvider = this.create(config);

    // Teste de conectividade
    try {
      await primaryProvider.analyze('teste', 'ping');
      return primaryProvider;
    } catch (error: any) {
      console.warn(`⚠️ Fallback: Provider principal falhou (${error.message})`);

      // Tenta Anthropic como fallback
      if (process.env.ANTHROPIC_API_KEY) {
        console.log('🔄 Tentando Anthropic como fallback...');
        return new AnthropicProvider(config);
      }

      // Tenta OpenAI como último fallback
      if (process.env.OPENAI_API_KEY) {
        console.log('🔄 Tentando OpenAI como último fallback...');
        return new OpenAIProvider(config);
      }

      // Se nada funcionar, relança o erro original
      throw error;
    }
  }
}
