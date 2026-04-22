# Estrutura do Projeto - Playwright Intelligence

```
play-intelligence/
│
├── src/                              # Código-fonte principal
│   ├── reporter/                     # Reporter Playwright
│   │   ├── collector.ts              # Coleta contexto de falhas
│   │   ├── mapper.ts                 # Mapeia rotas e cobertura
│   │   └── index.ts                  # Reporter combinado
│   │
│   ├── analyzer/                     # Análise com IA
│   │   ├── ai-client.ts              # Provedores de IA (Ollama, Anthropic, OpenAI)
│   │   └── prompts.ts                # Prompts estruturados
│   │
│   ├── cli.ts                        # Comandos CLI
│   ├── config.ts                     # Configuração centralizada
│   └── index.ts                      # Entry point (exports)
│
├── storage/                          # Dados gerados (ignorado pelo git)
│   ├── context.md                    # Contexto de falhas
│   ├── system-map.json               # Mapa de cobertura
│   ├── cache/                        # Cache de respostas
│   ├── reports/                      # Relatórios gerados
│   └── failures/                     # Screenshots de falhas
│
├── tests/                            # Testes exemplo
│   └── example.spec.ts
│
├── .env                              # Configuração local
├── .env.example                      # Template de .env
├── .gitignore                        # Arquivos ignorados
├── docker-compose.yml                # Docker para Ollama
├── setup-ollama.sh                   # Script de setup
├── Makefile                          # Comandos úteis
├── tsconfig.json                     # Configuração TypeScript
├── package.json                      # Dependências
├── playwright.config.ts              # Config Playwright
└── README.md                         # Este arquivo
```

## Componentes

### `/src/reporter` - Coleta de Dados
- **collector.ts**: Captura falhas, screenshots, stack traces
- **mapper.ts**: Mapeia rotas, ações, assertions, cobertura
- **index.ts**: Reporter combinado para Playwright

### `/src/analyzer` - Análise com IA
- **ai-client.ts**: Interface com Ollama (local), Anthropic, OpenAI
- **prompts.ts**: Prompts estruturados para análise

### `/src` - CLI e Configuração
- **cli.ts**: Comandos: `analyze`, `suggest-tests`, `fragility`, `health-check`
- **config.ts**: Carrega e valida configurações do `.env`
- **index.ts**: Export público dos componentes

### `/storage` - Dados Gerados
- `context.md`: Relatório de falhas coletadas
- `system-map.json`: Mapa de rotas e cobertura
- `cache/`: Cache de respostas da IA
- `reports/`: Análises geradas
- `failures/`: Screenshots de testes que falharam

## Como Usar

### Setup
```bash
npm install
bash setup-ollama.sh  # ou: make setup
```

### Rodar Testes
```bash
npm run test  # Roda testes e coleta dados automaticamente
```

### Análise com IA
```bash
npm run ai:analyze       # Analisa falhas
npm run ai:suggest       # Sugere novos testes
npm run ai:fragility     # Identifica testes frágeis
npm run ai:health        # Verifica saúde da IA
```

## Configuração

Edite `.env`:
```env
AI_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=qwen2.5-coder:7b
AI_TIMEOUT_MS=300000
AI_TEMPERATURE=0.2
AI_MAX_TOKENS=2000
```

## TypeScript

Compilar para JavaScript:
```bash
npm run build
# Gera arquivos em ./dist
```

## Integração com playwright.config.ts

```typescript
export default defineConfig({
  reporter: [
    ['list'],
    ['./src/reporter/index.ts'],  // ← Adicionar isto
  ],
});
```

---

✅ Projeto organizado e pronto para usar!
