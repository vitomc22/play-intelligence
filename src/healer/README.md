# 🏥 Healer - Correção Automática de Testes

O **Healer** é um agente de correção automática de testes que usa o **Aider** (ferramenta CLI de edição de código com IA) para executar correções de forma autônoma.

## Como Funciona

1. **Verifica Aider**: Confirma que o Aider está instalado no sistema
2. **Lê a análise**: Carrega o arquivo `storage/analysis-failures.md` gerado pelo analyzer
3. **Identifica testes**: Busca arquivos `tests/**/*.spec.ts` e `playwright.config.ts`
4. **Executa Aider**: Passa os arquivos e a instrução de correção ao Aider via CLI
5. **Valida resultado**: Executa testes para confirmar correções
6. **Documenta**: Salva relatório em `storage/healing-report-YYYY-MM-DD.md`

## Pré-requisitos

1. ✅ **Aider instalado**: `pip install aider-chat` ou `pipx install aider-chat`
2. ✅ **Ollama rodando**: `docker-compose up -d ollama`
3. ✅ Testes já foram executados: `npm run test`
4. ✅ Análise foi realizada: `npm run ai:analyze`

## Uso

### Via CLI
```bash
npm run ai:heal
```

### Saída Esperada
```
🏥 Iniciando Healer - Correção Automática de Testes
════════════════════════════════════════════════════

🔍 Step 1: Verificando instalação do Aider...
✅ Aider encontrado

📋 Step 2: Lendo análise de falhas...
✅ Análise carregada (5234 caracteres)

📁 Step 3: Identificando arquivos de teste...
✅ 3 arquivo(s) encontrado(s): tests/example.spec.ts, playwright.config.ts

🤖 Step 4: Executando Aider para corrigir testes...
   (Isso pode levar alguns minutos)
✅ Aider concluiu as correções

✔️ Step 5: Validando as correções...
   Rodando: npm run test
✅ Testes passando após correções!

📝 Step 6: Documentando as mudanças...
   Relatório salvo em: storage/healing-report-2025-04-23.md

✅ Healer finalizado com sucesso!
════════════════════════════════════════════════════
```

## Arquivos

### `aider-client.ts`
Cliente CLI para executar o Aider como processo filho.

**Métodos principais:**
- `runTask(message, files)` - Executa Aider com uma instrução e lista de arquivos
- `findTestFiles()` - Busca arquivos `*.spec.ts` no diretório `tests/`
- `checkInstallation()` - Verifica se o Aider está instalado

### `index.ts`
Orquestrador do processo de correção.

**Fluxo:**
1. `healFailingTests()` - Método principal
2. Verifica instalação do Aider
3. Lê análise do storage
4. Identifica arquivos de teste
5. Executa Aider com a instrução
6. Valida e documenta resultado

### `prompts.ts`
Instruções para o Aider realizar as correções.

**Prompts inclusos:**
- `fixFailingTests` - Instruções principais para correção
- `analyzeBeforeFix` - Análise antes de corrigir
- `validateFixes` - Validação após correção
- `documentChanges` - Documentação de mudanças

## Configuração

### Variáveis de Ambiente (`.env`)
```env
# Aider
AIDER_MODEL=ollama_chat/qwen2.5-coder:7b
AIDER_AUTO_COMMIT=true

# Ollama (backend do Aider)
OLLAMA_URL=http://localhost:11434

# Timeout para aguardar execução
HEALER_TIMEOUT=600000  # 10 minutos
```

## Fluxo de Correção

```
├─ Step 1: Verifica Aider
│   └─ aider --version
├─ Step 2: Valida análise
│   └─ Lê analysis-failures.md
├─ Step 3: Identifica arquivos
│   └─ Busca tests/**/*.spec.ts
├─ Step 4: Executa Aider
│   └─ aider --message "..." --model ... arquivo1 arquivo2
├─ Step 5: Valida testes
│   └─ npm run test
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

### "Aider não está instalado"
```bash
# Instalar via pip
pip install aider-chat

# Ou via pipx (isolado)
pipx install aider-chat

# Verificar instalação
aider --version
```

### "Análise não encontrada"
```bash
# Executar análise primeiro
npm run ai:analyze

# Depois rodar healer
npm run ai:heal
```

### "Timeout ao executar Aider"
- Aumentar `HEALER_TIMEOUT` no `.env`
- Verificar se Ollama está rodando: `curl http://localhost:11434/api/tags`
- Pode ser que o modelo está processando lentamente

### "Ollama não responde"
```bash
# Verificar se está rodando
docker ps | grep ollama

# Reiniciar
docker-compose restart ollama
```

## Integrações Futuras

- [ ] Webhook para CI/CD (GitHub Actions)
- [ ] Notificações via Slack
- [ ] Histórico de correções com git
- [ ] Multi-modelo (GPT-4, Claude, etc)
- [ ] Dashboard em tempo real

---

**Desenvolvido com ❤️ para testes mais inteligentes**
