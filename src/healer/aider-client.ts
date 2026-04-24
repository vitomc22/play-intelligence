/**
 * Cliente para comunicar com Aider
 * Aider é uma ferramenta CLI de edição de código com IA
 * Roda como processo filho via child_process.spawn()
 */

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

export interface AiderConfig {
  /** Modelo LLM no formato do Aider (ex: ollama_chat/qwen2.5-coder:7b) */
  model: string;
  /** URL base do Ollama (ex: http://localhost:11434) */
  ollamaUrl: string;
  /** Diretório raiz do workspace */
  workspaceDir: string;
  /** Timeout em ms para execução (padrão: 600000 = 10 min) */
  timeout: number;
  /** Se true, Aider faz commit automático das alterações */
  autoCommit: boolean;
}

export interface AiderResult {
  /** Se o processo terminou com sucesso (exit code 0) */
  success: boolean;
  /** Saída completa do stdout */
  output: string;
  /** Saída de erro (stderr) */
  errorOutput: string;
  /** Código de saída do processo */
  exitCode: number | null;
}

/**
 * Cliente para o Aider
 * Executa o Aider como processo filho para editar código automaticamente
 */
export class AiderClient {
  private config: AiderConfig;

  constructor(config: AiderConfig) {
    this.config = config;
  }

  /**
   * Executa o Aider com uma mensagem/instrução e uma lista de arquivos
   * 
   * @param message - Instrução em linguagem natural para o Aider
   * @param files - Lista de arquivos para o Aider editar (caminhos relativos ao workspace)
   * @returns Resultado da execução
   */
  async runTask(message: string, files: string[]): Promise<AiderResult> {
    return new Promise((resolve, reject) => {
      const args = this.buildArgs(message, files);

      console.log(`🤖 Executando Aider com modelo: ${this.config.model}`);
      console.log(`📁 Workspace: ${this.config.workspaceDir}`);
      console.log(`📄 Arquivos: ${files.length > 0 ? files.join(', ') : '(nenhum especificado)'}`);

      const proc = spawn('aider', args, {
        cwd: this.config.workspaceDir,
        env: {
          ...process.env,
          OLLAMA_API_BASE: this.config.ollamaUrl,
          OLLAMA_CONTEXT_LENGTH: '8192', // Aumenta contexto window (padrão é 2k)
        },
        // 'ignore' para stdin evita que o processo fique bloqueado esperando input
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Log das variáveis de ambiente para debug
      console.log(`🔌 Variáveis de ambiente:`);
      console.log(`   OLLAMA_API_BASE: ${this.config.ollamaUrl}`);
      console.log(`   OLLAMA_CONTEXT_LENGTH: 8192`);

      let stdout = '';
      let stderr = '';

      // Timeout para matar o processo se demorar demais
      const timeoutId = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error(`Timeout ao executar Aider após ${this.config.timeout}ms`));
      }, this.config.timeout);

      proc.stdout.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stdout += chunk;
        // Log em tempo real para o usuário acompanhar
        process.stdout.write(chunk);
      });

      proc.stderr.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;
        // Erros também em tempo real
        process.stderr.write(chunk);
      });

      proc.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve({
          success: code === 0,
          output: stdout,
          errorOutput: stderr,
          exitCode: code,
        });
      });

      proc.on('error', (error) => {
        clearTimeout(timeoutId);

        if ((error as any).code === 'ENOENT') {
          reject(new Error(
            'Aider não está instalado. Instale com: pip install aider-chat\n' +
            'Ou: pipx install aider-chat'
          ));
        } else {
          reject(error);
        }
      });
    });
  }

  /**
   * Monta a lista de argumentos CLI para o Aider
   */
  private buildArgs(message: string, files: string[]): string[] {
    // Converter timeout de ms para segundos para o Aider
    const aiderTimeoutSeconds = Math.ceil(this.config.timeout / 1000);
    
    const args: string[] = [
      '--message', message,
      '--model', this.config.model,
      '--timeout', String(aiderTimeoutSeconds), // Timeout em segundos
      '--yes',           // Aceita todas as confirmações automaticamente
      '--no-stream',     // Desabilita streaming (mais limpo para logs)
    ];

    if (!this.config.autoCommit) {
      args.push('--no-auto-commits');
    }

    // Adiciona os arquivos que o Aider deve considerar
    for (const file of files) {
      args.push(file);
    }

    // Log dos args para debug
    console.log(`📝 Args do Aider: ${args.join(' ')}`);

    return args;
  }

  /**
   * Encontra arquivos de teste no workspace
   * Busca recursivamente por *.spec.ts em tests/
   */
  findTestFiles(): string[] {
    const testsDir = path.join(this.config.workspaceDir, 'tests');
    if (!fs.existsSync(testsDir)) {
      return [];
    }

    const files: string[] = [];
    this.walkDir(testsDir, files);
    return files.map(f => path.relative(this.config.workspaceDir, f));
  }

  /**
   * Busca recursiva por arquivos .spec.ts
   */
  private walkDir(dir: string, results: string[]): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        this.walkDir(fullPath, results);
      } else if (entry.name.endsWith('.spec.ts')) {
        results.push(fullPath);
      }
    }
  }

  /**
   * Verifica se o Aider está instalado e acessível
   */
  async checkInstallation(): Promise<boolean> {
    return new Promise((resolve) => {
      const proc = spawn('aider', ['--version'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      proc.on('close', (code) => {
        resolve(code === 0);
      });

      proc.on('error', () => {
        resolve(false);
      });
    });
  }

  /**
   * Verifica se Ollama está acessível na URL configurada
   * A documentação do Aider recomenda aumentar OLLAMA_CONTEXT_LENGTH para 8192
   */
  async checkOllamaConnection(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      try {
        const response = await fetch(`${this.config.ollamaUrl}/api/tags`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        
        if (response.ok) {
          console.log(`✅ Ollama respondeu de ${this.config.ollamaUrl}`);
          return true;
        } else {
          console.warn(`⚠️  Ollama em ${this.config.ollamaUrl} retornou status ${response.status}`);
          return false;
        }
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error(`❌ Não conseguiu conectar em Ollama (${this.config.ollamaUrl}): ${(error as Error).message}`);
      return false;
    }
  }
}
