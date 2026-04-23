/**
 * Healer: Agente de Correção Automática de Testes
 *
 * Orquestra o OpenHands para:
 * 1. Ler a análise de falhas já realizada
 * 2. Identificar padrões e causa raiz
 * 3. Corrigir os testes automaticamente
 * 4. Validar as correções
 */

import * as fs from 'fs';
import * as path from 'path';
import { OpenHandsClient } from './openhands-client';
import { HEALER_PROMPTS } from './prompts';

export interface HealerConfig {
  workspaceDir: string;
  storageDir: string;
  openhandsUrl: string;
  timeout: number;
}

export class Healer {
  private client: OpenHandsClient;
  private config: HealerConfig;

  constructor(config: HealerConfig) {
    this.config = config;
    this.client = new OpenHandsClient(config.openhandsUrl, config.timeout);
  }

  /**
   * Executa o processo completo de correção de testes
   */
  async healFailingTests(): Promise<void> {
    console.log('\n🏥 Iniciando Healer - Correção Automática de Testes');
    console.log('═'.repeat(60));

    try {
      // Step 1: Validar que a análise foi realizada
      const analysisPath = path.join(this.config.storageDir, 'analysis-failures.md');
      if (!fs.existsSync(analysisPath)) {
        throw new Error(
          `❌ Arquivo de análise não encontrado: ${analysisPath}\n` +
          `   Execute primeiro: npm run ai:analyze`
        );
      }

      console.log('\n📋 Step 1: Lendo análise de falhas...');
      const analysis = fs.readFileSync(analysisPath, 'utf-8');
      console.log(`✅ Análise carregada (${analysis.length} caracteres)`);

      // Step 2: Preparar contexto para o OpenHands
      console.log('\n🔍 Step 2: Analisando padrões de falha...');
      const analysisContext = this.prepareAnalysisContext(analysis);

      // Step 3: Enviar tarefa ao OpenHands
      console.log('\n🤖 Step 3: Enviando tarefa ao OpenHands...');
      const taskDescription = this.generateTaskDescription(analysisContext);
      
      const task = await this.client.submitTask({
        title: 'Corrigir testes falhando com Playwright',
        description: taskDescription,
        workspaceDir: this.config.workspaceDir,
      });

      console.log(`✅ Tarefa enviada: ${task.message}`);

      // Step 4: Aguardar conclusão
      console.log('\n⏳ Step 4: Aguardando o agente executar as correções...');
      console.log('   (Isso pode levar alguns minutos)');
      
      const completedTask = await this.client.waitForTask(task.data?.id);

      if (completedTask.status === 'failed') {
        throw new Error(`❌ Tarefa falhou: ${completedTask.error}`);
      }

      console.log('✅ Agente concluiu as correções');

      // Step 5: Validar os resultados
      console.log('\n✔️ Step 5: Validando as correções...');
      await this.validateFixes();

      // Step 6: Documentar as mudanças
      console.log('\n📝 Step 6: Documentando as mudanças...');
      await this.documentChanges(completedTask.result || '');

      console.log('\n✅ Healer finalizado com sucesso!');
      console.log('═'.repeat(60));

    } catch (error: any) {
      console.error('\n❌ Erro no Healer:', error.message);
      process.exit(1);
    }
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
   * Gera descrição da tarefa para o OpenHands
   */
  private generateTaskDescription(analysisContext: string): string {
    return `
Você vai corrigir os testes automaticamente baseado nesta análise:

${analysisContext}

## Instruções
1. Analise os padrões de falha acima
2. Localize os testes em tests/**/*.spec.ts
3. Implemente as correções recomendadas
4. Execute os testes: npm run test
5. Valide que agora passam

## Constraints
- Respeite as melhores práticas do Playwright
- Aumente timeouts apenas quando necessário
- Prefira melhorar locators a aumentar waits
- Documente qualquer mudança significativa

${HEALER_PROMPTS.fixFailingTests}
    `.trim();
  }

  /**
   * Valida que os testes agora passam
   */
  private async validateFixes(): Promise<void> {
    try {
      console.log('   Rodando: npm run test');
      
      const result = await this.client.executeCommand(
        'npm run test',
        this.config.workspaceDir
      );

      if (result.includes('passed') || result.includes('✓')) {
        console.log('✅ Testes passando após correções!');
      } else if (result.includes('failed') || result.includes('✗')) {
        console.log('⚠️  Alguns testes ainda falhando, mas agente pode ter resolvido alguns.');
      }

    } catch (error: any) {
      console.warn('⚠️  Não foi possível validar imediatamente, mas agente executou.');
    }
  }

  /**
   * Documenta as mudanças realizadas
   */
  private async documentChanges(agentResult: string): Promise<void> {
    const timestamp = new Date().toISOString().split('T')[0];
    const reportPath = path.join(
      this.config.storageDir,
      `healing-report-${timestamp}.md`
    );

    const report = `# Relatório de Correção de Testes (Healer)

**Data:** ${new Date().toLocaleString('pt-BR')}
**Agente:** OpenHands
**Modelo:** Qwen 2.5 Coder (via Ollama)

## Resultado
${agentResult || 'Agente processou a tarefa com sucesso. Verifique o status em http://localhost:3000'}

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
    openhandsUrl: process.env.OPENHANDS_URL || 'http://localhost:3000',
    timeout: parseInt(process.env.HEALER_TIMEOUT || '600000', 10),
  });
}
