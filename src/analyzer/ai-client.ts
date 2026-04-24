export interface AIProvider {
  analyze(prompt: string, context: string): Promise<string>;
}

/**
 * Configurações para provedores locais e em nuvem
 * Prioridade: Ollama (local) > Anthropic (cloud)
 */
export interface AIConfig {
  provider: 'ollama' | 'anthropic' | 'openai';
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
  temperature?: number;
  maxTokens?: number;
}

// ─── Ollama (local, gratuito, Ryzen 7 3ª gen + 16GB RAM) ────

export class OllamaProvider implements AIProvider {
  private baseUrl: string;
  private model: string;
  private timeout: number;
  private temperature: number;
  private maxTokens: number;

  constructor(config: Partial<AIConfig> = {}) {
    this.model = config.model || process.env.OLLAMA_MODEL || 'qwen2.5-coder:1.5b';
    this.baseUrl = config.baseUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
    this.timeout = config.timeout || 400000; // 5 min para Ryzen processar
    this.temperature = config.temperature ?? 0.2; // Baixo para respostas técnicas
    this.maxTokens = config.maxTokens || 3000;
  }

  async analyze(prompt: string, context: string): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      console.log(`📡 Conectando ao Ollama (${this.model})...`);
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          stream: false,
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
          temperature: this.temperature,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            `Modelo '${this.model}' não encontrado. Execute: ollama pull ${this.model}`
          );
        }
        throw new Error(`Ollama error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as any;
      return data.message?.content ?? '';
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error(`Timeout após ${this.timeout}ms. CPU Ryzen processando lentamente.`);
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

// ─── Anthropic Claude (cloud, $$$, fallback) ──────────────────

export class AnthropicProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private maxTokens: number;

  constructor(config: Partial<AIConfig> = {}) {
    this.apiKey = config.apiKey || process.env.ANTHROPIC_API_KEY || '';
    this.model = config.model || 'claude-3-5-sonnet-20241022';
    this.maxTokens = config.maxTokens || 3000;

    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY não definida');
    }
  }

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
        max_tokens: this.maxTokens,
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

// ─── OpenAI GPT (cloud, $$$, fallback) ──────────────────────

export class OpenAIProvider implements AIProvider {
  private apiKey: string;
  private model: string;
  private maxTokens: number;

  constructor(config: Partial<AIConfig> = {}) {
    this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || '';
    this.model = config.model || 'gpt-4o-mini';
    this.maxTokens = config.maxTokens || 2000;

    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY não definida');
    }
  }

  async analyze(prompt: string, context: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: this.maxTokens,
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

// ─── Factory (seleciona provider com fallback automático) ─────

export class AIProviderFactory {
  /**
   * Cria o provider apropriado baseado em variáveis de ambiente
   * Prioridade: Ollama (local) > Anthropic > OpenAI
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
   * Cria provider com fallback automático se o primeiro falhar
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
