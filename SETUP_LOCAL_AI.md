# 🚀 Guia de Setup - Qwen 7B com Ollama (Ryzen 7 + 16GB RAM)

## Seu Hardware
- **CPU**: Ryzen 7 3ª geração (multithreaded, suporta AVX2)
- **RAM**: 16GB
- **Conclusão**: ✅ **Suficiente para Qwen 7B** (precisa de ~15GB quando carregado)

---

## Opção 1: Docker + Ollama (Recomendado)

### 1.1 Instalar Docker
```bash
# Fedora
sudo dnf install docker -y
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker $USER  # Evita sudo
```

### 1.2 Rodar Ollama em Docker
```bash
# Porta 11434 é o padrão
docker run -d \
  --name ollama \
  -p 11434:11434 \
  -v ollama:/root/.ollama \
  ollama/ollama
```

### 1.3 Baixar qgemma4:e2b
```bash
# Via docker
docker exec ollama ollama pull gemma4:e2b

# Ou direto se tiver Ollama instalado
ollama pull gemma4:e2b
```

### 1.4 Testar Conexão
```bash
curl http://localhost:11434/api/tags
# Deve retornar: {"models":[{"name":"gemma4:e2b",...}]}
```

---

## Opção 2: Usar seu Alpaca (Mais Simples!)

Você já baixou Qwen Coder 2.5 no Alpaca. **Use-o!**

### 2.1 Verificar se está rodando
```bash
# Alpaca geralmente usa:
http://127.0.0.1:8000  # ou porta configurada no app
```

### 2.2 Adaptar para seu projeto
```bash
# No seu .env
OLLAMA_URL=http://127.0.0.1:8000
OLLAMA_MODEL=qwen-coder-2.5
```

---

## Configurar seu Projeto

### 3.1 Criar `.env` local
```bash
cp .env.example .env
```

### 3.2 Editar `.env`
```env
AI_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:e2b
AI_TIMEOUT_MS=300000  # 5 min (CPU precisa processar)
AI_TEMPERATURE=0.2
AI_MAX_TOKENS=2000
```

### 3.3 Instalar dependências
```bash
npm install
npm install dotenv  # Para carregar .env
```

---

## Usar no VS Code

### Opção A: Continue.dev Extension
1. Instale [Continue](https://marketplace.visualstudio.com/items?itemName=Continue.continue)
2. Configure `~/.continue/config.json`:
   ```json
   {
     "models": [
       {
         "title": "Qwen Local",
         "provider": "ollama",
         "model": "gemma4:e2b",
         "apiBase": "http://localhost:11434"
       }
     ]
   }
   ```
3. Selecione "Qwen Local" no VS Code

### Opção B: Copilot Chat com fallback
- Copilot tentará usar Ollama primeiro
- Se falhar, usará Anthropic/OpenAI (se tiver API key)

---

## Rodando Análise

### 4.1 Executar Playwright com Intelligence
```bash
npx playwright test --reporter ./index.ts
```

### 4.2 Análise com IA Local
```bash
npx ts-node cli.ts analyze
```

Saída esperada:
```
📡 Conectando ao Ollama (gemma4:e2b)...
⏳ Processando... (pode levar 1-5 min)
✅ Análise concluída!
```

---

## Performance

### Esperado com Ryzen 7 3ª gen + 16GB
- **Tempo de resposta**: 1-5 minutos (não otimizado para inferência)
- **Velocidade**: ~10 tokens/segundo
- **Qualidade**: Excelente para análise de código

### Dicas de Otimização
```bash
# 1. Use GPU (se tiver NVIDIA)
docker run --gpus all ollama/ollama

# 2. Use modelo menor (se muito lento)
ollama pull qwen2.5:3b  # 3B = ~5-10 tokens/s

# 3. Aumente RAM virtual
# Edite /etc/docker/daemon.json:
{
  "storage-driver": "overlay2",
  "storage-opts": ["overlay2.override_kernel_check=true"]
}
```

---

## Troubleshooting

### ❌ "Modelo não encontrado"
```bash
docker exec ollama ollama pull gemma4:e2b
```

### ❌ "Conexão recusada"
```bash
# Verifique se Ollama está rodando
docker ps | grep ollama
docker logs ollama
```

### ❌ "Timeout após 5 minutos"
Aumentar timeout em `.env`:
```env
AI_TIMEOUT_MS=600000  # 10 min
```

### ❌ "Memoria cheia"
Reduzir modelo:
```env
OLLAMA_MODEL=qwen2.5:3b
```

---

## Próximos Passos

1. ✅ Docker + Ollama rodando
2. ✅ Qwen 7B/3B baixado
3. ✅ `.env` configurado
4. ✅ Rodar testes Playwright
5. ✅ Executar análise com IA

**Não gasta tokens. Roda localmente. Gratuito.**

