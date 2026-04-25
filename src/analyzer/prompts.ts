/**
 * @fileoverview Prompt templates for AI analysis and suggestions.
 * These prompts define how the AI should interpret test failures and system maps.
 */

/**
 * Collection of prompts for different AI analysis tasks.
 */
export const PROMPTS = {
  analyzeFailures: `
Analise as falhas de testes Playwright abaixo e retorne um relatório em markdown com:

## 1. Padrões identificados
Agrupe falhas com causa raiz similar. Para cada padrão:
- Descrição do padrão
- Testes afetados
- Causa provável (seletor frágil, timing, bug real, ambiente)

## 2. Prioridade de correção
Liste as falhas em ordem de impacto (crítico / alto / médio / baixo).
Justifique cada classificação.

## 3. Ações recomendadas
Para cada padrão, sugira a correção mais objetiva possível.
Se for problema de seletor, mostre o seletor atual e um mais robusto.
Se for timing, mostre como usar waitFor corretamente.

## 4. Falhas intermitentes (flaky)
Identifique testes que provavelmente são flaky vs bugs reais.
`,

  suggestTests: `
Com base no system-map abaixo, gere novos testes Playwright em TypeScript.

Regras:
- Foque em rotas com coverage score abaixo de 60%
- Cubra os gaps identificados no campo "gaps" de cada rota
- Use Page Object Model
- Cada teste deve ser autocontido (sem dependência de estado externo)
- Adicione comentários explicando o que cada teste cobre
- Use boas práticas: getByRole, getByTestId (evite seletores CSS frágeis)

Formato de saída:
\`\`\`typescript
// tests/{rota}/{descricao}.spec.ts
import { test, expect } from '@playwright/test';

test.describe('...', () => {
  test('...', async ({ page }) => {
    ...
  });
});
\`\`\`
`,

  identifyFragility: `
Analise o system-map e o histórico de falhas. Retorne um relatório em markdown com:

## 1. Componentes frágeis
Liste componentes/seletores com failureCount alto.
Para cada um: frequência de falha, padrão do seletor, sugestão de melhoria.

## 2. Rotas críticas com baixa cobertura
Rotas que são críticas para o negócio (login, checkout, pagamento) mas têm score baixo.

## 3. Pontos cegos
Fluxos importantes que nunca aparecem nos testes — baseie-se nas rotas mapeadas
e no que seria esperado cobrir em um sistema web típico.

## 4. Score de saúde geral
Dê uma nota de 0 a 100 para a suite de testes com justificativa.
`,
};
