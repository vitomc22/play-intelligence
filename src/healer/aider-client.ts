/**
 * @fileoverview Aider Client Module.
 * Provides a wrapper around the Aider CLI tool for automated code editing with AI.
 * Aider runs as a child process and communicates with the AI provider (usually Ollama).
 */
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Configuration for the Aider client.
 */
export interface AiderConfig {
  /** The LLM model name in Aider's format (e.g., 'ollama_chat/gemma4:e2b'). */
  model: string;
  /** The base URL for the Ollama API. */
  ollamaUrl: string;
  /** The absolute path to the workspace root. */
  workspaceDir: string;
  /** Maximum execution time in milliseconds. */
  timeout: number;
  /** Whether Aider should automatically commit its changes to Git. */
  autoCommit: boolean;
}

/**
 * The result of an Aider execution.
 */
export interface AiderResult {
  /** True if Aider exited with a zero status code. */
  success: boolean;
  /** Full standard output of the Aider process. */
  output: string;
  /** Full standard error output of the Aider process. */
  errorOutput: string;
  /** The numeric exit code of the process. */
  exitCode: number | null;
}

/**
 * Client class for interacting with the Aider CLI.
 */
export class AiderClient {
  private config: AiderConfig;

  /**
   * Creates an instance of AiderClient.
   * @param config The configuration to use for all tasks.
   */
  constructor(config: AiderConfig) {
    this.config = config;
  }

  /**
   * Executes a specific task with Aider.
   * Spawns a child process and captures its output.
   * 
   * @param message The natural language instruction for the AI.
   * @param files List of relative file paths that Aider is allowed to edit.
   * @returns A promise resolving to the execution result.
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
   * Constructs the command-line arguments for the Aider command.
   * @param message The instruction for the AI.
   * @param files The files to be modified.
   * @returns An array of string arguments.
   * @private
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
   * Recursively finds all Playwright test files (*.spec.ts) in the workspace's tests/ directory.
   * @returns An array of relative paths to test files.
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
   * Helper function to recursively walk a directory looking for spec files.
   * @private
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
   * Checks if the Aider CLI is installed and responsive.
   * @returns A promise resolving to true if installed.
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
   * Validates the connection to the Ollama API.
   * Checks for a 200 OK from /api/tags.
   * @returns A promise resolving to true if reachable.
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
