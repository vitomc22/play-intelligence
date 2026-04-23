/**
 * Prompts para o OpenHands - Agente de Correção de Testes
 * Esses prompts orientam o agente na correção automática de testes falhos
 */

export const HEALER_PROMPTS = {
  /**
   * Prompt principal para o OpenHands corrigir testes
   * Baseado na análise de falhas já realizada
   */
  fixFailingTests: `
Você é um especialista em testes automatizados com Playwright e vai atuar como um agente de IA (OpenHands) para corrigir testes falhos automaticamente.

## Contexto
Você recebeu uma análise de testes que falharam. Sua tarefa é:
1. Entender os padrões de falha descritos
2. Localizar os testes no código
3. Aplicar correções específicas
4. Executar os testes novamente para validar

## Instruções
- Analise cada padrão de falha fornecido
- Para cada falha, implemente a correção recomendada no código-fonte
- Use as melhores práticas do Playwright
- Sempre execute os testes após corrigir para validar
- Documente as mudanças realizadas

## Padrões de Falha Comuns no Playwright

### WebKit Internal Errors
- Causa: Browser instável ou timeout inadequado
- Solução: 
  - Remover WebKit dos browsers testados (usar chromium e firefox)
  - Aumentar timeouts na navegação: { waitUntil: 'domcontentloaded', timeout: 30000 }
  - Adicionar retry logic

### Timing/Timeout Issues
- Causa: Elementos não carregados ou timing inadequado
- Solução:
  - Usar waitFor adequadamente
  - Adicionar timeouts explícitos nas operações
  - Usar locators mais robustos (getByRole ao invés de id/class)

### Network/Navigation Errors
- Causa: Falhas de conectividade ou DNS
- Solução:
  - Adicionar retry para requisições
  - Usar { waitUntil: 'domcontentloaded' }
  - Validar se o site está acessível

## Arquivos a Modificar
- \`tests/**/*.spec.ts\` - Testes do Playwright
- \`playwright.config.ts\` - Configurações globais

## Após as Correções
1. Execute: \`npm run test\`
2. Verifique se todos os testes passam
3. Se houver novas falhas, repita o processo
4. Documente as mudanças em um commit

## Responda em Português
Mantenha clareza técnica mas em português.
`,

  /**
   * Prompt para análise detalhada antes de corrigir
   */
  analyzeBeforeFix: `
Você é um agente de análise de testes. Baseado na análise de falhas fornecida:

1. Identifique o ROOT CAUSE de cada falha
2. Categorize por tipo de problema (network, timeout, selector, etc)
3. Priorize as correções (críticas primeiro)
4. Sugira a estratégia de correção para cada uma

Formato esperado:
## Falha 1: [Nome do Teste]
- Tipo: [tipo de falha]
- Causa Raiz: [descrição]
- Estratégia: [como corrigir]
- Prioridade: [Alta/Média/Baixa]

---

Depois, parta para a implementação.
`,

  /**
   * Prompt para validar que os testes passam
   */
  validateFixes: `
Você é um validador de testes. Após implementar as correções:

1. Execute todos os testes
2. Verifique quais passaram
3. Identifique ainda há falhas residuais
4. Se houver, aplique correções adicionais
5. Documente o resultado final

Gere um relatório final com:
- ✅ Testes que agora passam
- ❌ Testes que ainda falham (com razão)
- 📊 Taxa de sucesso (X/Y testes passando)
`,

  /**
   * Prompt para documentar as mudanças
   */
  documentChanges: `
Após corrigir os testes, documente as mudanças em um formato claro:

## Resumo das Correções
- [Lista de mudanças realizadas]

## Arquivos Modificados
- \`tests/example.spec.ts\` - [O que foi mudado]
- \`playwright.config.ts\` - [O que foi mudado]

## Problema Original
[Descreva o problema]

## Solução Implementada
[Descreva a solução]

## Teste Validação
[Comando executado e resultado]
`,
};
