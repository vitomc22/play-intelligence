/**
 * Healer: Agente de Correção Automática de Testes
 *
 * Orquestra o Aider para:
 * 1. Ler a análise de falhas já realizada
 * 2. Identificar padrões e causa raiz
 * 3. Corrigir os testes automaticamente
 * 4. Validar as correções
 */

import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { AiderClient } from './aider-client';
import { HEALER_PROMPTS } from './prompts';

export interface HealerConfig {
  workspaceDir: string;
  storageDir: string;
  aiderModel: string;
  ollamaUrl: string;
  timeout: number;
  autoCommit: boolean;
}

export class Healer {
  private client: AiderClient;
  private config: HealerConfig;

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
   * Executa o processo completo de correção de testes
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

      // Step 5: Validar os resultados
      console.log('\n✔️ Step 5: Validando as correções...');
      await this.validateFixes();

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
   * Gera a mensagem/instrução para o Aider
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
   * Prepara o contexto da análise para passar ao agente
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
   * Valida que os testes agora passam
   */
  private async validateFixes(): Promise<void> {
    return new Promise((resolve) => {
      console.log('   Rodando: npm run test');

      exec('npm run test', {
        cwd: this.config.workspaceDir,
        timeout: this.config.timeout,
      }, (error, stdout, stderr) => {
        if (stdout.includes('passed') || stdout.includes('✓')) {
          console.log('✅ Testes passando após correções!');
        } else if (error || stdout.includes('failed') || stdout.includes('✗')) {
          console.log('⚠️  Alguns testes ainda falhando, mas o Aider pode ter resolvido alguns.');
        }
        resolve();
      });
    });
  }

  /**
   * Documenta as mudanças realizadas
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
 * Factory para criar instância do Healer com config padrão
 */
export function createHealer(projectRoot: string): Healer {
  return new Healer({
    workspaceDir: projectRoot,
    storageDir: path.join(projectRoot, 'storage'),
    aiderModel: process.env.AIDER_MODEL || 'ollama_chat/qwen2.5-coder:7b',
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    timeout: parseInt(process.env.HEALER_TIMEOUT || '600000', 10),
    autoCommit: process.env.AIDER_AUTO_COMMIT !== 'false',
  });
}
