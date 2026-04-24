#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { AIProviderFactory } from './analyzer/ai-client';
import { PROMPTS } from './analyzer/prompts';
import { config, validateConfig, printConfig } from './config';
import { createHealer } from './healer';

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
 * Análise de falhas: identifica padrões e causa raiz
 */
async function analyzeFailures() {
  const contextPath = config.paths.context;

  if (!fs.existsSync(contextPath)) {
    console.error(`❌ Arquivo de contexto não encontrado: ${contextPath}`);
    console.error('   Execute: npx playwright test --reporter ./src/reporter/index.ts');
    process.exit(1);
  }

  console.log('\n📊 Analisando falhas de testes...');

  const context = fs.readFileSync(contextPath, 'utf-8');
  const systemMap = fs.existsSync(config.paths.systemMap)
    ? fs.readFileSync(config.paths.systemMap, 'utf-8')
    : 'Mapa não disponível';

  const provider = AIProviderFactory.create({
    provider: config.ai.provider,
    model: config.ollama.model,
    baseUrl: config.ollama.url,
    timeout: config.ai.timeout,
    temperature: config.ai.temperature,
    maxTokens: config.ai.maxTokens,
  });

  const response = await provider.analyze(PROMPTS.analyzeFailures, `${context}\n\n${systemMap}`);
  console.log('\n' + response);

  // Salva resultado
  const outputPath = path.join(config.paths.storage, 'analysis-failures.md');
  fs.mkdirSync(config.paths.storage, { recursive: true });
  fs.writeFileSync(outputPath, response);
  console.log(`\n✅ Análise salva em: ${outputPath}`);
}

/**
 * Sugestão de novos testes baseado em cobertura
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
    maxTokens: config.ai.maxTokens,
  });

  const response = await provider.analyze(PROMPTS.suggestTests, systemMap);
  console.log('\n' + response);

  // Salva resultado
  const outputPath = path.join(config.paths.storage, 'suggested-tests.md');
  fs.mkdirSync(config.paths.storage, { recursive: true });
  fs.writeFileSync(outputPath, response);
  console.log(`\n✅ Sugestões salvas em: ${outputPath}`);
}

/**
 * Identifica testes frágeis (flaky tests)
 */
async function identifyFragility() {
  const contextPath = config.paths.context;
  const systemMapPath = config.paths.systemMap;

  if (!fs.existsSync(contextPath)) {
    console.error(`❌ Arquivo de contexto não encontrado: ${contextPath}`);
    process.exit(1);
  }

  console.log('\n🔍 Analisando fragilidade de testes...');

  const context = fs.readFileSync(contextPath, 'utf-8');
  const systemMap = fs.existsSync(systemMapPath)
    ? fs.readFileSync(systemMapPath, 'utf-8')
    : 'Mapa não disponível';

  const provider = AIProviderFactory.create({
    provider: config.ai.provider,
    model: config.ollama.model,
    baseUrl: config.ollama.url,
    timeout: config.ai.timeout,
    temperature: config.ai.temperature,
    maxTokens: config.ai.maxTokens,
  });

  const response = await provider.analyze(PROMPTS.identifyFragility, `${context}\n\n${systemMap}`);
  console.log('\n' + response);

  // Salva resultado
  const outputPath = path.join(config.paths.storage, 'fragility-report.md');
  fs.mkdirSync(config.paths.storage, { recursive: true });
  fs.writeFileSync(outputPath, response);
  console.log(`\n✅ Relatório salvo em: ${outputPath}`);
}

/**
 * Health check: verifica se IA está acessível
 */
async function healthCheck() {
  console.log('\n🏥 Verificando saúde da IA...');

  try {
    const provider = AIProviderFactory.create({
      provider: config.ai.provider,
      model: config.ollama.model,
      baseUrl: config.ollama.url,
      timeout: 30000, // 30s timeout para health check
      temperature: config.ai.temperature,
      maxTokens: 100,
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
 * Healer: Usa Aider para corrigir testes automaticamente
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
