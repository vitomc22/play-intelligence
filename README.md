# play-intelligence
Minha tentativa de fazer um plawright inteligente

# Playwright Intelligence

Ferramenta que intercepta a execução de testes Playwright para coletar contexto de falhas, mapear cobertura do sistema e usar IA local (Ollama) para analisar padrões e sugerir melhorias.

**🎯 Sem custos de API. Roda 100% localmente no seu PC.**

---

## 🚀 Quick Start (Docker)

### Pré-requisitos
- Docker instalado

### Setup automático (Recomendado)

```bash
# 1. Clone/copie para seu projeto
cp -r play-intelligence/ seu-projeto/
cd seu-projeto

# 2. Execute o setup (vai instalar Ollama + Qwen no Docker)
bash setup-ollama.sh

# 3. Pronto! Comece a usar
npm run test:intelligence
```

### Setup manual

```bash
# 1. Inicia Ollama em Docker
docker-compose up -d

# 2. Aguarde 30s e baixe o modelo
docker exec playwright-ollama ollama pull gemma4:e2b

# 3. Instale dependências
npm install

# 4. Configure seu projeto
```

---

## 📋 Setup Detalhado

### Opção 1: Docker (Recomendado para Ryzen 7)

```bash
# Inicia Ollama + Qwen no Docker
make start

# Verifica se está rodando
make health

# Ver logs
make logs

# Parar quando terminar
make stop
```

### Opção 2: Ollama Standalone (se preferir)

```bash
# Instalar Ollama
curl -fsSL https://ollama.com/install.sh | sh

# Baixar modelo
ollama pull gemma4:e2b

# Rodar Ollama
ollama serve
```

### Opção 3: Usar seu Alpaca (se já tem)

Se já baixou Qwen Coder 2.5 no Alpaca:

```bash
# Edite .env
OLLAMA_URL=http://127.0.0.1:8000
OLLAMA_MODEL=qwen-coder-2.5
```

---

## 📁 Estrutura do Projeto

```
play-intelligence/
├── reporter/
│   ├── collector.ts      # Captura falhas
│   ├── mapper.ts         # Mapeia cobertura
│   └── index.ts          # Reporter combinado
├── analyzer/
│   ├── ai-client.ts      # Interface com IA (Ollama/Anthropic/OpenAI)
│   └── prompts.ts        # Prompts estruturados
├── cli.ts                # Comandos CLI
├── config.ts             # Configuração centralizada
├── .env                  # Variáveis de ambiente
├── docker-compose.yml    # Docker para Ollama
├── setup-ollama.sh       # Script de setup
└── Makefile              # Comandos úteis
```

---

## 🎯 Uso

### 1. Configurar seu projeto Playwright

Adicione o reporter no `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],
    ['./reporter/index.ts'],  // ← Adicione esta linha
  ],
});
```

### 2. Rodar testes (collector + mapper executam automáticamente)

```bash
# Executa testes com coleta de contexto
npm run test:intelligence
```

### 3. Analisar com IA

```bash
# Analisa falhas e identifica padrões
npm run ai:analyze

# Sugere novos testes baseado em cobertura
npm run ai:suggest

# Identifica testes frágeis
npm run ai:fragility

# Health check da IA
npm run ai:health
```

---

## ⚙️ Configuração

### Variáveis de ambiente (`.env`)

```env
# Provider de IA (padrão: ollama)
AI_PROVIDER=ollama

# Ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:e2b

# Timeouts (em ms)
AI_TIMEOUT_MS=300000        # 5 min (para Ryzen processar)

# Parâmetros
AI_TEMPERATURE=0.2          # Baixo = mais determinístico
AI_MAX_TOKENS=2000

# Diretório de armazenamento
STORAGE_DIR=./storage
ENABLE_CACHE=true
```

---

## 📊 Modelos Recomendados

### Para seu Ryzen 7 3ª gen + 16GB RAM

| Modelo | Tamanho | Qualidade | Velocidade |
|--------|--------|-----------|-----------|
| **gemma4:e2b** | ~5GB RAM | ⭐⭐⭐⭐⭐ | ~30s/resposta |
| qwen2.5:7b | ~5GB RAM | ⭐⭐⭐⭐ | ~30s/resposta |
| llama2:7b | ~4GB RAM | ⭐⭐⭐ | ~30s/resposta |
| mistral:7b | ~4GB RAM | ⭐⭐⭐⭐ | ~30s/resposta |

**Recomendação**: Qwen 2.5 Coder é especializado em análise de código.

---

## 🔧 Troubleshooting

### ❌ "Modelo não encontrado"
```bash
# Baixe manualmente
docker exec playwright-ollama ollama pull gemma4:e2b

# Ou verifique quais modelos estão disponíveis
curl http://localhost:11434/api/tags
```

### ❌ "Conexão recusada"
```bash
# Verifique se Ollama está rodando
docker ps | grep ollama

# Se não estiver, inicie
docker-compose up -d

# Ver logs
docker logs playwright-ollama
```

### ❌ "Timeout após 5 minutos"
CPU está lenta. Aumente o timeout em `.env`:
```env
AI_TIMEOUT_MS=600000  # 10 minutos
```

### ❌ "Memória cheia"
Reduza o modelo:
```env
OLLAMA_MODEL=qwen2.5:3b  # Versão 3B ao invés de 7B
```

---

## 📁 Estrutura de arquivos

```
play-intelligence/
├── reporter/
│   ├── collector.ts         # Captura contexto de falhas
│   ├── mapper.ts            # Mapeia ações e cobertura
│   └── index.ts             # Reporter combinado
├── analyzer/
│   ├── ai-client.ts         # Interface com IA
│   └── prompts.ts           # Prompts estruturados
├── storage/
│   ├── context.md           # Todas as falhas
│   ├── system-map.json      # Mapa de cobertura
│   └── cache/               # Cache de respostas
├── cli.ts                   # Comandos CLI
├── config.ts                # Configuração centralizada
├── .env                     # Variáveis de ambiente
├── docker-compose.yml       # Docker para Ollama
├── setup-ollama.sh          # Script de setup
└── Makefile                 # Comandos úteis
```

---

## 💡 Performance

### Esperado no seu Ryzen 7 3ª gen
- **Tempo de resposta**: 1-5 minutos por análise
- **Velocidade**: ~10 tokens/segundo (CPU)
- **Qualidade**: Excelente para análise de código

### Otimizações

#### 1. GPU (se tiver NVIDIA)
```bash
docker run --gpus all -d -p 11434:11434 ollama/ollama
# Vai para ~200 tokens/segundo
```

#### 2. Modelo menor
```env
OLLAMA_MODEL=llama2:3b  # 3x mais rápido, um pouco menos preciso
```

#### 3. Aumentar worker threads
```env
# Edite docker-compose.yml
environment:
  - OLLAMA_NUM_PARALLEL=4
```

---

## 📚 Exemplos de Output

### Análise de Falhas
```markdown
## 1. Padrões Identificados

### Seletores Frágeis (5 falhas)
- Elemento não encontrado em `#user-profile > .modal`
- Causa: DOM changes em atualizações de versão
- Solução: Usar `getByRole('dialog')` ao invés

...
```

### Sugestão de Testes
```typescript
// tests/checkout/coupon-integration.spec.ts
test('deve validar cupom expirado', async ({ page }) => {
  // Novo teste sugerido pela IA
  // Coverage score atual: 45% → 72% com este teste
  ...
});
```

---

## 🚨 Notas Importantes

- ✅ **Sem custos**: Roha 100% offline
- ⚠️ **Primeira execução**: Pode levar 20-30min para baixar modelo (~5GB)
- 🔄 **Cache**: Respostas são cacheadas por hash do contexto
- 📊 **Storage**: Verifique `./storage` após rodar testes

---

## 🎯 Próximos Passos

1. ✅ Execute `bash setup-ollama.sh`
2. ✅ Rode seus testes: `npm run test:intelligence`
3. ✅ Analise: `npm run ai:analyze`
4. ✅ Revise relatórios em `./storage/reports/`
5. ✅ Implemente sugestões

---

## 📞 Suporte

Veja `SETUP_LOCAL_AI.md` para troubleshooting detalhado.
cat playwright-intelligence/storage/reports/report-*.md

# 4. Limpar storage entre campanhas de testes
npm run pwi:reset
```

## Variáveis de ambiente

| Variável | Default | Descrição |
|---|---|---|
| `AI_PROVIDER` | `ollama` | Provider de IA: `ollama` ou `anthropic` |
| `OLLAMA_MODEL` | `gemma4:e2b` | Modelo Ollama a usar |
| `OLLAMA_URL` | `http://localhost:11434` | URL da API Ollama |
| `ANTHROPIC_API_KEY` | — | Chave Anthropic (se usar fallback cloud) |

## Modelos recomendados

| Modelo | RAM | Quando usar |
|---|---|---|
| `gemma4:e2b` | ~6 GB | **Recomendado** — especializado em código |
| `deepseek-coder-v2:16b` | ~12 GB | Máquinas potentes, melhor qualidade |
| `llama3.2:3b` | ~3 GB | Máquinas com pouca RAM |

## Estrutura de arquivos gerados

```
playwright-intelligence/
└── storage/
    ├── context.md              # Todas as falhas coletadas
    ├── system-map.json         # Mapa de cobertura por rota
    ├── failures/
    │   └── run-{id}/           # Screenshots por execução
    └── reports/
        └── report-{date}.md    # Relatório gerado pela IA
```
