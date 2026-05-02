#!/usr/bin/env node
/**
 * @fileoverview CLI Entry Point.
 * Provides a command-line interface for interacting with the Playwright Intelligence tools.
 * Supports analysis, test suggestion, fragility reporting, and automated healing.
 */

import * as fs from 'fs';
import * as path from 'path';
import { AIProviderFactory } from './analyzer/ai-client';
import { PROMPTS } from './analyzer/prompts';
import { config, validateConfig, printConfig } from './config';
import { createHealer } from './healer';

/**
 * Main execution loop for the CLI.
 * Parses command-line arguments and routes to the appropriate function.
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  try {
    // Valida configuração
    validateConfig();
    printConfig();

    switch (command) {
      case 'analyze':
        await analyzeFailures();
        break;
      case 'suggest-tests':
        await suggestTests();
        break;
      case 'fragility':
        await identifyFragility();
        break;
      case 'heal':
        await healTests();
        break;
      case 'health-check':
        await healthCheck();
        break;
      case 'help':
      default:
        printHelp();
        break;
    }
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

/**
 * Recursively finds all error-context.md files in a directory.
 */
function findErrorContexts(dir: string, fileList: string[] = []): string[] {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findErrorContexts(filePath, fileList);
    } else if (file === 'error-context.md') {
      fileList.push(filePath);
    }
  }
  return fileList;
}

/**
 * Analyzes recent test failures.
 * Reads failure context and system map, then sends them to the AI for pattern identification.
 * Results are displayed in the console and saved as a Markdown report.
 */
async function analyzeFailures() {
  const testResultsPath = (config.paths as any).testResults || path.join(process.cwd(), 'test-results');

  if (!fs.existsSync(testResultsPath)) {
    console.error(`❌ Diretório de resultados não encontrado: ${testResultsPath}`);
    console.error('   Execute os testes do Playwright para gerar falhas.');
    process.exit(1);
  }

  console.log('\n📊 Iniciando análise inteligente...');

  const systemMap = fs.existsSync(config.paths.systemMap)
    ? fs.readFileSync(config.paths.systemMap, 'utf-8')
    : 'Mapa não disponível';

  const provider = AIProviderFactory.create({
    provider: config.ai.provider,
    model: config.ollama.model,
    baseUrl: config.ollama.url,
    timeout: config.ai.timeout,
    temperature: config.ai.temperature,
  });

  const errorContextFiles = findErrorContexts(testResultsPath);

  if (errorContextFiles.length === 0) {
    console.log('✅ Nenhuma falha encontrada para analisar na pasta test-results.');
    return;
  }

  let combinedContext = '';
  let hasChanges = false;

  for (const contextFile of errorContextFiles) {
    let content = fs.readFileSync(contextFile, 'utf-8');
    const dir = path.dirname(contextFile);
    const failureId = path.basename(dir);

    // 1. Processamento Visual (Gemma 4 Vision)
    if (!content.includes('### Análise Visual')) {
      const pngs = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
      if (pngs.length > 0) {
        // Usa a primeira imagem PNG encontrada no diretório da falha
        const screenshotPath = path.join(dir, pngs[0]);
        if (provider.analyzeImage) {
          process.stdout.write(`🖼️  Analisando visualmente FAILURE em ${failureId}...`);
          try {
            const visualAnalysis = await provider.analyzeImage(screenshotPath, PROMPTS.analyzeScreenshot);
            content += `\n\n### Análise Visual (Gemma 4 Vision)\n${visualAnalysis}\n`;
            fs.writeFileSync(contextFile, content);
            hasChanges = true;
            process.stdout.write(' ✅\n');
          } catch (err) {
            process.stdout.write(' ❌ (erro na visão)\n');
          }
        }
      }
    }

    combinedContext += `\n## FAILURE from ${failureId}\n${content}\n---\n`;
  }

  if (hasChanges) {
    console.log('📝 Contexto atualizado com descrições visuais.');
  }

  // 2. Análise de Padrões e Causa Raiz
  console.log('📋 Analisando padrões de falha (Texto + Visão)...');
  const response = await provider.analyze(PROMPTS.analyzeFailures, `${combinedContext}\n\n${systemMap}`);

  const formattedResponse = `
# 🔍 Playwright Intelligence - Análise de Resultados
> Gerado em: ${new Date().toLocaleString('pt-BR')}
> Provedor: ${config.ai.provider} | Modelo: ${config.ai.provider === 'ollama' ? config.ollama.model : config.ai.provider}

---

${response}

---
_💡 Dica: Use 'npm run ai:heal' para tentar corrigir as falhas acima automaticamente (requer Aider)._
  `.trim();

  console.log('\n' + formattedResponse);

  // Salva resultado final
  const outputPath = path.join(config.paths.storage, 'analysis-failures.md');
  fs.mkdirSync(config.paths.storage, { recursive: true });
  fs.writeFileSync(outputPath, formattedResponse);
  console.log(`\n✅ Relatório completo salvo em: ${outputPath}`);
}



/**
 * Generates suggestions for new test cases based on the current system map and identified coverage gaps.
 */
async function suggestTests() {
  const systemMapPath = config.paths.systemMap;

  if (!fs.existsSync(systemMapPath)) {
    console.error(`❌ Arquivo de mapa não encontrado: ${systemMapPath}`);
    console.error('   Execute: npx playwright test --reporter ./src/reporter/index.ts');
    process.exit(1);
  }

  console.log('\n🧪 Gerando sugestões de testes...');

  const systemMap = fs.readFileSync(systemMapPath, 'utf-8');
  const provider = AIProviderFactory.create({
    provider: config.ai.provider,
    model: config.ollama.model,
    baseUrl: config.ollama.url,
    timeout: config.ai.timeout,
    temperature: config.ai.temperature,
  });

  const response = await provider.analyze(PROMPTS.suggestTests, systemMap);

  const formattedResponse = `
# 🧪 Playwright Intelligence - Sugestões de Testes
> Gerado em: ${new Date().toLocaleString('pt-BR')}
> Provedor: ${config.ai.provider} | Modelo: ${config.ai.provider === 'ollama' ? config.ollama.model : config.ai.provider}

---

${response}

---
_💡 Dica: Copie e cole os testes acima em novos arquivos na pasta 'tests/'._
  `.trim();

  console.log('\n' + formattedResponse);

  // Salva resultado
  const outputPath = path.join(config.paths.storage, 'suggested-tests.md');
  fs.mkdirSync(config.paths.storage, { recursive: true });
  fs.writeFileSync(outputPath, formattedResponse);
  console.log(`\n✅ Sugestões salvas em: ${outputPath}`);
}

/**
 * Identifies fragile or "flaky" tests by analyzing historical failure data and system mapping.
 */
async function identifyFragility() {
  const testResultsPath = (config.paths as any).testResults || path.join(process.cwd(), 'test-results');
  const systemMapPath = config.paths.systemMap;

  if (!fs.existsSync(testResultsPath)) {
    console.error(`❌ Diretório de resultados não encontrado: ${testResultsPath}`);
    process.exit(1);
  }

  console.log('\n🔍 Analisando fragilidade de testes...');

  const errorContextFiles = findErrorContexts(testResultsPath);
  let combinedContext = '';
  for (const contextFile of errorContextFiles) {
    const content = fs.readFileSync(contextFile, 'utf-8');
    combinedContext += `\n## FAILURE from ${path.basename(path.dirname(contextFile))}\n${content}\n---\n`;
  }

  const systemMap = fs.existsSync(systemMapPath)
    ? fs.readFileSync(systemMapPath, 'utf-8')
    : 'Mapa não disponível';

  const provider = AIProviderFactory.create({
    provider: config.ai.provider,
    model: config.ollama.model,
    baseUrl: config.ollama.url,
    timeout: config.ai.timeout,
    temperature: config.ai.temperature,
  });

  const response = await provider.analyze(PROMPTS.identifyFragility, `${combinedContext}\n\n${systemMap}`);

  const formattedResponse = `
# 🔍 Playwright Intelligence - Relatório de Fragilidade
> Gerado em: ${new Date().toLocaleString('pt-BR')}
> Provedor: ${config.ai.provider} | Modelo: ${config.ai.provider === 'ollama' ? config.ollama.model : config.ai.provider}

---

${response}

---
_💡 Dica: Foque em corrigir os seletores dos componentes listados como críticos._
  `.trim();

  console.log('\n' + formattedResponse);

  // Salva resultado
  const outputPath = path.join(config.paths.storage, 'fragility-report.md');
  fs.mkdirSync(config.paths.storage, { recursive: true });
  fs.writeFileSync(outputPath, formattedResponse);
  console.log(`\n✅ Relatório salvo em: ${outputPath}`);
}

/**
 * Performs a health check on the configured AI provider.
 * Verifies connectivity and model availability.
 */
async function healthCheck() {
  console.log('\n🏥 Verificando saúde da IA...');

  try {
    const provider = AIProviderFactory.create({
      provider: config.ai.provider,
      model: config.ollama.model,
      baseUrl: config.ollama.url,
      timeout: 120000, // 2 min timeout para health check (CPU local)
      temperature: config.ai.temperature,
    });

    const response = await provider.analyze('Responda com: OK', 'teste');

    if (response.toLowerCase().includes('ok')) {
      console.log('✅ IA respondendo normalmente');
      console.log(`   Provider: ${config.ai.provider}`);
      console.log(`   Modelo: ${config.ollama.model}`);
      console.log(`   URL: ${config.ollama.url}`);
    } else {
      console.warn('⚠️ IA respondeu, mas resposta inesperada:', response);
    }
  } catch (error: any) {
    console.error('❌ IA não está acessível:', error.message);
    process.exit(1);
  }
}

/**
 * Launches the automated test healing process using the Healer module and Aider agent.
 * Requires a prior analysis run to provide context.
 */
async function healTests() {
  console.log('\n🏥 Iniciando Healer com Aider...');

  try {
    const projectRoot = process.cwd();
    const healer = createHealer(projectRoot);
    await healer.healFailingTests();
  } catch (error: any) {
    console.error('❌ Erro ao executar Healer:', error.message);
    process.exit(1);
  }
}

/**
 * Prints the help message to the console, listing available commands and setup instructions.
 */
function printHelp() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║   Playwright Intelligence - CLI                               ║
╚════════════════════════════════════════════════════════════════╝

Comandos disponíveis:

  npx ts-node src/cli.ts analyze
    Analisa falhas de testes e identifica padrões

  npx ts-node src/cli.ts suggest-tests
    Gera sugestões de novos testes baseado em cobertura

  npx ts-node src/cli.ts fragility
    Identifica testes frágeis (flaky tests)

  npx ts-node src/cli.ts heal
    🆕 Usa Aider para corrigir testes automaticamente
    (Requer que 'npm run ai:analyze' tenha sido executado primeiro)

  npx ts-node src/cli.ts health-check
    Verifica se a IA está acessível

  npx ts-node src/cli.ts help
    Exibe esta mensagem

Setup:
  1. Copie .env.example para .env
  2. Configure seu provider (ollama/anthropic/openai)
  3. Execute: npx playwright test --reporter ./src/reporter/index.ts
  4. Rode um comando acima

Documentação: veja SETUP_LOCAL_AI.md
  `);
}

main().catch(console.error);
