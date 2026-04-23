#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Setup - Inicia Ollama + Qwen no Docker
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Playwright Intelligence - Setup Ollama + Qwen 7B      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

echo "🐳 Verificando Docker..."

# Usando 'type' que é mais robusto em scripts bash/zsh
if ! type docker > /dev/null 2>&1; then
    echo "❌ Docker não está no PATH!"
    echo "   Verificado em: /usr/bin/docker"
    exit 1
fi

# Verificando o Daemon
if ! docker ps > /dev/null 2>&1; then
    echo "❌ Docker daemon não está rodando ou permissão negada!"
    echo "   Tente: sudo systemctl start docker"
    echo "   Ou adicione seu usuário ao grupo: sudo usermod -aG docker \$USER"
    exit 1
fi

echo "✅ Docker OK! Versão: $(docker -v)"
echo ""

# ─── Verifica docker-compose ───────────────────────────────
echo "🐳 Verificando docker-compose..."
if ! type docker-compose > /dev/null 2>&1 && ! docker compose version > /dev/null 2>&1; then
    echo "❌ docker-compose não disponível!"
    echo "   Instale com: pip install docker-compose"
    exit 1
fi
echo "✅ docker-compose disponível"
echo ""

# ─── Inicia Ollama + OpenHands ─────────────────────────────
echo "📦 Iniciando Ollama + OpenHands em Docker..."
echo "   (Primeira execução: fará pull de ~3GB para Ollama + ~2GB para OpenHands)"
echo ""

if docker compose up -d ollama openhands-agent; then
    echo "✅ Containers iniciados"
else
    echo "❌ Erro ao iniciar containers"
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

# ─── Aguarda OpenHands estar pronto ────────────────────────
echo "⏳ Aguardando OpenHands estar pronto (até 120s)..."
RETRY=0
MAX_RETRIES=120

while [ $RETRY -lt $MAX_RETRIES ]; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo ""
        echo "✅ OpenHands está respondendo em http://localhost:3000"
        break
    fi
    RETRY=$((RETRY + 1))
    echo -n "."
    sleep 1
done

if [ $RETRY -eq $MAX_RETRIES ]; then
    echo ""
    echo "⚠️  Aviso: OpenHands pode estar demorando para iniciar"
    echo "   Execute: docker logs playwright-openhands-agent"
    echo "   E aguarde ou reinicie: docker compose restart openhands-agent"
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

# ─── Testa conexão com Ollama ──────────────────────────────
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

# ─── Testa configuração do OpenHands ───────────────────────
echo "🧪 Validando configuração do OpenHands..."
OPENHANDS_READY=$(curl -s http://localhost:3000 | grep -c "html\|OpenHands" || echo "0")

if [ "$OPENHANDS_READY" -gt 0 ]; then
    echo "✅ OpenHands UI acessível em http://localhost:3000"
    echo ""
    echo "📝 Configuração do OpenHands:"
    echo "   • LLM_PROVIDER: ollama"
    echo "   • LLM_MODEL: ollama/qwen2.5-coder:7b"
    echo "   • LLM_BASE_URL: http://ollama:11434"
    echo "   • WORKSPACE_BASE: $(pwd)"
else
    echo "⚠️  OpenHands UI pode estar inicializando"
    echo "   Aguarde alguns segundos e acesse: http://localhost:3000"
fi

echo ""

# ─── Testa conexão com Ollama ──────────────────────────────
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

# ─── Testa configuração do OpenHands ───────────────────────
echo "🧪 Validando configuração do OpenHands..."
OPENHANDS_READY=$(curl -s http://localhost:3000 | grep -c "html\|OpenHands" || echo "0")

if [ "$OPENHANDS_READY" -gt 0 ]; then
    echo "✅ OpenHands UI acessível em http://localhost:3000"
    echo ""
    echo "📝 Configuração do OpenHands:"
    echo "   • LLM_PROVIDER: ollama"
    echo "   • LLM_MODEL: ollama/qwen2.5-coder:7b"
    echo "   • LLM_BASE_URL: http://ollama:11434"
    echo "   • WORKSPACE_BASE: $(pwd)"
else
    echo "⚠️  OpenHands UI pode estar inicializando"
    echo "   Aguarde alguns segundos e acesse: http://localhost:3000"
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
echo "     npm run test"
echo ""
echo "  3. Analisar com IA (Ollama):"
echo "     npm run ai:analyze"
echo ""
echo "  4. 🆕 Corrigir testes automaticamente (OpenHands):"
echo "     npm run ai:heal"
echo ""
echo "📋 Comandos úteis:"
echo ""
echo "  Ver status:      docker compose ps"
echo "  Ver logs Ollama: docker logs playwright-ollama -f"
echo "  Ver logs OpenHands: docker logs playwright-openhands-agent -f"
echo "  Parar tudo:      docker compose down"
echo "  Reiniciar:       docker compose restart"
echo ""
echo "🌐 Acessar interfaces:"
echo ""
echo "  OpenHands:  http://localhost:3000"
echo "  Ollama API: http://localhost:11434"
echo ""
echo "📚 Documentação:"
echo "  • ARQUITETURA.md - Explicação completa do projeto"
echo "  • src/healer/README.md - Guia de uso do Healer"
echo ""
