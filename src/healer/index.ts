/**
 * @fileoverview Healer Module.
 * Orchestrates the automated test healing workflow using the Aider agent.
 * The workflow includes reading AI analysis, identifying test files, and running Aider to apply fixes.
 */
import * as fs from 'fs';
import * as path from 'path';
import { AiderClient } from './aider-client';
import { HEALER_PROMPTS } from './prompts';

/**
 * Configuration for the Healer orchestrator.
 */
export interface HealerConfig {
  /** Root directory of the project. */
  workspaceDir: string;
  /** Directory where analysis and reports are stored. */
  storageDir: string;
  /** The model identifier for Aider. */
  aiderModel: string;
  /** The base URL for the Ollama API. */
  ollamaUrl: string;
  /** Maximum execution time in milliseconds. */
  timeout: number;
  /** Whether changes should be automatically committed. */
  autoCommit: boolean;
}

/**
 * Orchestrator class for the automated test healing process.
 */
export class Healer {
  private client: AiderClient;
  private config: HealerConfig;

  /**
   * Creates an instance of Healer.
   * @param config The configuration for the healing process.
   */
  constructor(config: HealerConfig) {
    this.config = config;
    this.client = new AiderClient({
      model: config.aiderModel,
      ollamaUrl: config.ollamaUrl,
      workspaceDir: config.workspaceDir,
      timeout: config.timeout,
      autoCommit: config.autoCommit,
    });
  }

  /**
   * Orchestrates the complete test healing workflow.
   * 1. Validates Aider and Ollama availability.
   * 2. Reads the failure analysis report.
   * 3. Identifies test files to be edited.
   * 4. Runs Aider to apply fixes.
   * 5. Documents the changes made.
   * 
   * @throws {Error} If any step in the workflow fails.
   */
  async healFailingTests(): Promise<void> {
    console.log('\n🏥 Iniciando Healer - Correção Automática de Testes');
    console.log('═'.repeat(60));

    try {
      // Step 1: Verificar que o Aider está instalado
      console.log('\n🔍 Step 1: Verificando instalação do Aider...');
      const aiderInstalled = await this.client.checkInstallation();
      if (!aiderInstalled) {
        throw new Error(
          '❌ Aider não está instalado.\n' +
          '   Instale com: pip install aider-chat\n' +
          '   Ou: pipx install aider-chat'
        );
      }
      console.log('✅ Aider encontrado');

      // Step 1.5: Verificar que Ollama está acessível (conforme docs do Aider)
      console.log('\n🔍 Step 1.5: Verificando conexão com Ollama em ' + this.config.ollamaUrl + '...');
      const ollamaAccessible = await this.client.checkOllamaConnection();
      if (!ollamaAccessible) {
        throw new Error(
          `❌ Ollama não está acessível em ${this.config.ollamaUrl}\n` +
          `   Inicie o Ollama com:\n` +
          `   OLLAMA_CONTEXT_LENGTH=8192 ollama serve\n` +
          `   (Veja: https://aider.chat/docs/llms/ollama.html)`
        );
      }
      console.log('✅ Ollama acessível');

      // Step 2: Validar que a análise foi realizada
      const analysisPath = path.join(this.config.storageDir, 'analysis-failures.md');
      if (!fs.existsSync(analysisPath)) {
        throw new Error(
          `❌ Arquivo de análise não encontrado: ${analysisPath}\n` +
          `   Execute primeiro: npm run ai:analyze`
        );
      }

      console.log('\n📋 Step 2: Lendo análise de falhas...');
      const analysis = fs.readFileSync(analysisPath, 'utf-8');
      console.log(`✅ Análise carregada (${analysis.length} caracteres)`);

      // Step 3: Identificar arquivos de teste
      console.log('\n📁 Step 3: Identificando arquivos de teste...');
      const testFiles = this.client.findTestFiles();

      // Inclui também o playwright.config.ts como arquivo editável
      const playwrightConfig = 'playwright.config.ts';
      const filesToEdit = [...testFiles];
      if (fs.existsSync(path.join(this.config.workspaceDir, playwrightConfig))) {
        filesToEdit.push(playwrightConfig);
      }

      if (filesToEdit.length === 0) {
        throw new Error('❌ Nenhum arquivo de teste encontrado em tests/**/*.spec.ts');
      }
      console.log(`✅ ${filesToEdit.length} arquivo(s) encontrado(s): ${filesToEdit.join(', ')}`);

      // Step 4: Montar prompt e executar Aider
      console.log('\n🤖 Step 4: Executando Aider para corrigir testes...');
      console.log('   ⏱️  Timeout: 3 minutos (pode aumentar com HEALER_TIMEOUT=900000)');
      console.log('   ℹ️  A primeira execução pode ser lenta (carregando modelo em Ollama)');
      console.log('   (Isso pode levar alguns minutos)\n');

      const taskMessage = this.generateTaskMessage(analysis);
      const result = await this.client.runTask(taskMessage, filesToEdit);

      if (!result.success) {
        console.error('\n⚠️  Aider terminou com erros.');
        if (result.errorOutput) {
          console.error('Detalhes:', result.errorOutput.substring(0, 500));
        }
      } else {
        console.log('\n✅ Aider concluiu as correções');
      }

      // Step 6: Documentar as mudanças
      console.log('\n📝 Step 6: Documentando as mudanças...');
      await this.documentChanges(result.output);

      console.log('\n✅ Healer finalizado com sucesso!');
      console.log('═'.repeat(60));

    } catch (error: any) {
      console.error('\n❌ Erro no Healer:', error.message);
      process.exit(1);
    }
  }

  /**
   * Generates the structured task message for Aider.
   * Combines failure analysis with healing instructions.
   * @param analysis The content of the AI analysis report.
   * @returns A formatted string instruction.
   * @private
   */
  private generateTaskMessage(analysis: string): string {
    const analysisContext = this.prepareAnalysisContext(analysis);

    return `
Corrija os testes automatizados Playwright baseado nesta análise de falhas:

${analysisContext}

## Instruções
1. Analise os padrões de falha acima
2. Implemente as correções recomendadas nos arquivos de teste
3. Respeite as melhores práticas do Playwright
4. Prefira melhorar locators a aumentar waits
5. Aumente timeouts apenas quando necessário

${HEALER_PROMPTS.fixFailingTests}
    `.trim();
  }

  /**
   * Extracts relevant snippets from the analysis report to minimize prompt noise.
   * @param analysis The full content of the analysis report.
   * @returns A condensed version of the analysis focused on failure patterns.
   * @private
   */
  private prepareAnalysisContext(analysis: string): string {
    // Extrai informações importantes do arquivo de análise
    const lines = analysis.split('\n');

    let context = '';
    let inPatternSection = false;

    for (const line of lines) {
      if (line.includes('Padrão') || inPatternSection) {
        context += line + '\n';
        inPatternSection = true;
      }
      if (inPatternSection && line.includes('---')) {
        break;
      }
    }

    return context || analysis;
  }

  /**
   * Generates a persistent Markdown report of the changes performed by the Healer.
   * @param aiderOutput The console output from the Aider process.
   * @private
   */
  private async documentChanges(aiderOutput: string): Promise<void> {
    const timestamp = new Date().toISOString().split('T')[0];
    const reportPath = path.join(
      this.config.storageDir,
      `healing-report-${timestamp}.md`
    );

    const report = `# Relatório de Correção de Testes (Healer)

**Data:** ${new Date().toLocaleString('pt-BR')}
**Agente:** Aider
**Modelo:** ${this.config.aiderModel}

## Resultado
${aiderOutput ? aiderOutput.substring(0, 3000) : 'Aider processou a tarefa com sucesso.'}

## Próximos Passos
1. Verifique as mudanças: \`git diff\`
2. Valide os testes: \`npm run test\`
3. Se ainda houver falhas, execute novamente: \`npm run ai:heal\`

---
_Gerado automaticamente pelo Healer_
    `.trim();

    fs.mkdirSync(this.config.storageDir, { recursive: true });
    fs.writeFileSync(reportPath, report);
    console.log(`   Relatório salvo em: ${reportPath}`);
  }
}

/**
 * Factory function to create a new Healer instance with default configuration.
 * Loads settings from environment variables.
 * @param projectRoot The absolute path to the project's root directory.
 * @returns A fully configured Healer instance.
 */
export function createHealer(projectRoot: string): Healer {
  return new Healer({
    workspaceDir: projectRoot,
    storageDir: path.join(projectRoot, 'storage'),
    aiderModel: process.env.AIDER_MODEL || 'ollama_chat/gemma4:e2b',
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    // Timeout padrão: 3 minutos (180000 ms). Pode ser aumentado com HEALER_TIMEOUT
    timeout: parseInt(process.env.HEALER_TIMEOUT || '180000', 10),
    autoCommit: process.env.AIDER_AUTO_COMMIT !== 'false',
  });
}
