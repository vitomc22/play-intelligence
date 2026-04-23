# 🏥 Healer - Correção Automática de Testes

O **Healer** é um agente de correção automática de testes que usa o **OpenHands** (agente de IA) para executar correções de forma autônoma.

## Como Funciona

1. **Lê a análise**: Carrega o arquivo `storage/analysis-failures.md` gerado pelo analyzer
2. **Prepara contexto**: Extrai padrões de falha e causa raiz
3. **Envia ao OpenHands**: Comunica via API REST com o agente em Docker
4. **Aguarda execução**: Agente corrige os testes automaticamente
5. **Valida resultado**: Executa testes para confirmar correções
6. **Documenta**: Salva relatório em `storage/healing-report-YYYY-MM-DD.md`

## Pré-requisitos

1. ✅ Testes já foram executados: `npm run test`
2. ✅ Análise foi realizada: `npm run ai:analyze`
3. ✅ OpenHands está rodando em Docker: `bash setup-ollama.sh`

## Uso

### Via CLI
```bash
npm run ai:heal
```

### Saída Esperada
```
🏥 Iniciando Healer - Correção Automática de Testes
════════════════════════════════════════════════════

📋 Step 1: Lendo análise de falhas...
✅ Análise carregada (5234 caracteres)

🔍 Step 2: Analisando padrões de falha...

🤖 Step 3: Enviando tarefa ao OpenHands...
✅ Tarefa enviada: Corrigir testes falhando com Playwright

⏳ Step 4: Aguardando o agente executar as correções...
   (Isso pode levar alguns minutos)
✅ Agente concluiu as correções

✔️ Step 5: Validando as correções...
   Rodando: npm run test
✅ Testes passando após correções!

📝 Step 6: Documentando as mudanças...
   Relatório salvo em: storage/healing-report-2025-04-23.md

✅ Healer finalizado com sucesso!
════════════════════════════════════════════════════
```

## Arquivos

### `openhands-client.ts`
Cliente REST para comunicar com o agente OpenHands.

**Métodos principais:**
- `submitTask(task)` - Envia uma tarefa de correção
- `executeCommand(cmd, dir)` - Executa comando no sandbox
- `waitForTask(taskId)` - Aguarda conclusão com polling

### `healer.ts`
Orquestrador do processo de correção.

**Fluxo:**
1. `healFailingTests()` - Método principal
2. Lê análise do storage
3. Gera descrição da tarefa
4. Envia ao OpenHands
5. Aguarda conclusão
6. Documenta resultado

### `prompts.ts`
Instruções para o OpenHands realizar as correções.

**Prompts inclusos:**
- `fixFailingTests` - Instruções principais para correção
- `analyzeBeforeFix` - Análise antes de corrigir
- `validateFixes` - Validação após correção
- `documentChanges` - Documentação de mudanças

## Configuração

### Variáveis de Ambiente (`.env`)
```env
# OpenHands
OPENHANDS_URL=http://localhost:3000

# Timeout para aguardar agente
HEALER_TIMEOUT=600000  # 10 minutos
```

## Fluxo de Correção

```
├─ Step 1: Valida análise
├─ Step 2: Prepara contexto
│   └─ Extrai padrões de falha
├─ Step 3: Envia tarefa
│   ├─ Monta descrição
│   └─ POST /api/tasks
├─ Step 4: Aguarda conclusão
│   └─ Polling: GET /api/tasks/{id}
├─ Step 5: Valida testes
│   └─ Executa: npm run test
└─ Step 6: Documenta
    └─ Salva healing-report.md
```

## Padrões de Falha Tratados

### WebKit Internal Errors
```
Antes:  ❌ Error: page.goto: WebKit encountered an internal error
Depois: ✅ Remover WebKit, usar chromium + firefox
```

### Timing Issues
```
Antes:  ❌ Timeout: element not found after 30s
Depois: ✅ Adicionar waitFor com timeout explícito
```

### Network Errors
```
Antes:  ❌ ECONNREFUSED - Cannot reach server
Depois: ✅ Adicionar retry + waitUntil: 'domcontentloaded'
```

## Resultado

Após conclusão, verifique:

```bash
# Ver relatório
cat storage/healing-report-*.md

# Ver mudanças
git diff

# Validar localmente
npm run test
```

## Troubleshooting

### "OpenHands não está rodando"
```bash
# Verificar se está em Docker
docker ps | grep openhands

# Se não estiver, iniciar
bash setup-ollama.sh
```

### "Análise não encontrada"
```bash
# Executar análise primeiro
npm run ai:analyze

# Depois rodar healer
npm run ai:heal
```

### "Timeout ao aguardar agente"
- Aumentar `HEALER_TIMEOUT` no `.env`
- Verificar logs: `docker logs playwright-openhands-agent`
- Pode ser que o modelo Ollama está processando lentamente

## Integrações Futuras

- [ ] Webhook para CI/CD (GitHub Actions)
- [ ] Notificações via Slack
- [ ] Histórico de correções com git
- [ ] Multi-modelo (GPT-4, Claude, etc)
- [ ] Dashboard em tempo real

---

**Desenvolvido com ❤️ para testes mais inteligentes**
