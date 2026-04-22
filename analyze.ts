#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { AIProviderFactory } from './src/analyzer/ai-client';
import { PROMPTS } from './src/analyzer/prompts';

const STORAGE_DIR = path.resolve(__dirname, '../storage');
const CONTEXT_FILE = path.join(STORAGE_DIR, 'context.md');
const MAP_FILE = path.join(STORAGE_DIR, 'system-map.json');
const REPORTS_DIR = path.join(STORAGE_DIR, 'reports');

async function analyze() {
  console.log('\n🔍 Playwright Intelligence — Análise iniciada\n');

  // Validações
  if (!fs.existsSync(CONTEXT_FILE)) {
    console.error('❌ context.md não encontrado. Rode os testes primeiro.');
    process.exit(1);
  }
  if (!fs.existsSync(MAP_FILE)) {
    console.error('❌ system-map.json não encontrado. Rode os testes primeiro.');
    process.exit(1);
  }

  const context = fs.readFileSync(CONTEXT_FILE, 'utf-8');
  const systemMap = fs.readFileSync(MAP_FILE, 'utf-8');
  const ai = AIProviderFactory.create();

  const provider = process.env.AI_PROVIDER ?? 'ollama';
  const model = process.env.OLLAMA_MODEL ?? 'qwen2.5-coder:7b';
  console.log(`🤖 Provider: ${provider}${provider === 'ollama' ? ` (${model})` : ''}\n`);

  fs.mkdirSync(REPORTS_DIR, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportFile = path.join(REPORTS_DIR, `report-${timestamp}.md`);

  let report = `# Playwright Intelligence Report\n_Gerado em ${new Date().toLocaleString('pt-BR')}_\n\n`;

  // ── 1. Análise de falhas ─────────────────────────────────
  const hasFailures = context.includes('## FAILURE');

  if (hasFailures) {
    process.stdout.write('📋 Analisando padrões de falha...');
    const failureAnalysis = await ai.analyze(PROMPTS.analyzeFailures, context);
    process.stdout.write(' ✅\n');
    report += `# Análise de Falhas\n\n${failureAnalysis}\n\n---\n\n`;
  } else {
    console.log('✅ Nenhuma falha registrada no context.md');
    report += `# Análise de Falhas\n\n✅ Nenhuma falha registrada.\n\n---\n\n`;
  }

  // ── 2. Fragilidade e cobertura ───────────────────────────
  process.stdout.write('🗺️  Analisando cobertura e fragilidade...');
  const fragilityAnalysis = await ai.analyze(PROMPTS.identifyFragility, systemMap);
  process.stdout.write(' ✅\n');
  report += `# Cobertura e Fragilidade\n\n${fragilityAnalysis}\n\n---\n\n`;

  // ── 3. Sugestão de novos testes ──────────────────────────
  const lowCoverageRoutes = getLowCoverageRoutes(systemMap);

  if (lowCoverageRoutes.length > 0) {
    process.stdout.write(`🧪 Sugerindo testes para ${lowCoverageRoutes.length} rota(s) com baixa cobertura...`);
    const suggestions = await ai.analyze(PROMPTS.suggestTests, systemMap);
    process.stdout.write(' ✅\n');
    report += `# Sugestões de Novos Testes\n\n${suggestions}\n\n---\n\n`;
  } else {
    console.log('✅ Todas as rotas com cobertura adequada.');
  }

  // ── Salva relatório ──────────────────────────────────────
  fs.writeFileSync(reportFile, report);
  console.log(`\n✨ Relatório salvo em: ${reportFile}\n`);
}

function getLowCoverageRoutes(mapJson: string): string[] {
  try {
    const map = JSON.parse(mapJson);
    return Object.entries(map.coverage ?? {})
      .filter(([, v]: [string, any]) => v.score < 60)
      .map(([route]) => route);
  } catch {
    return [];
  }
}

analyze().catch((err) => {
  console.error('\n❌ Erro durante análise:', err.message);
  if (err.message.includes('ECONNREFUSED') || err.message.includes('fetch')) {
    console.error('\nDica: Verifique se o Ollama está rodando: ollama serve');
  }
  process.exit(1);
});
