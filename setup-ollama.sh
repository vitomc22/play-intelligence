#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Setup - Inicia Ollama + Qwen no Docker
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Playwright Intelligence - Setup Ollama + Qwen 7B      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# ─── Verifica Docker ───────────────────────────────────────
echo "🐳 Verificando Docker..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não está instalado!"
    echo "   Instale em: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker daemon não está rodando!"
    echo "   Execute: sudo systemctl start docker"
    exit 1
fi

echo "✅ Docker instalado e rodando"
echo ""

# ─── Inicia Ollama ─────────────────────────────────────────
echo "📦 Iniciando Ollama em Docker..."
if docker-compose up -d ollama; then
    echo "✅ Container Ollama iniciado"
else
    echo "❌ Erro ao iniciar Ollama"
    exit 1
fi

# ─── Aguarda Ollama estar pronto ───────────────────────────
echo ""
echo "⏳ Aguardando Ollama estar pronto (até 60s)..."
RETRY=0
MAX_RETRIES=60

while [ $RETRY -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama está respondendo!"
        break
    fi
    RETRY=$((RETRY + 1))
    echo -n "."
    sleep 1
done

if [ $RETRY -eq $MAX_RETRIES ]; then
    echo ""
    echo "❌ Timeout: Ollama não respondeu após 60s"
    echo "   Execute: docker logs playwright-ollama"
    exit 1
fi

echo ""
echo ""

# ─── Baixa modelo Qwen ─────────────────────────────────────
echo "🤖 Baixando Qwen 2.5 Coder 7B..."
echo "   (Primeira vez: ~5GB, pode levar 10-20 min)"
echo ""

if docker exec playwright-ollama ollama pull qwen2.5-coder:7b; then
    echo ""
    echo "✅ Qwen 2.5 Coder 7B baixado!"
else
    echo ""
    echo "❌ Erro ao baixar modelo"
    exit 1
fi

echo ""

# ─── Testa conexão ────────────────────────────────────────
echo "🧪 Testando conexão com Ollama..."
if curl -s -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-coder:7b",
    "messages": [{"role": "user", "content": "oi"}],
    "stream": false
  }' | grep -q "assistant"; then
    echo "✅ Ollama respondendo corretamente!"
else
    echo "⚠️  Resposta inesperada. Verifique com: curl http://localhost:11434/api/tags"
fi

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║  ✅ Setup Completo!                                     ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "🚀 Próximos passos:"
echo ""
echo "  1. Instalar dependências do projeto:"
echo "     npm install"
echo ""
echo "  2. Rodar testes com Playwright Intelligence:"
echo "     npm run test:intelligence"
echo ""
echo "  3. Analisar com IA:"
echo "     npm run ai:analyze"
echo ""
echo "📋 Comandos úteis:"
echo ""
echo "  Ver logs:        docker logs playwright-ollama"
echo "  Parar Ollama:    docker-compose down"
echo "  Reiniciar:       docker-compose restart ollama"
echo "  Listar modelos:  curl http://localhost:11434/api/tags"
echo ""
