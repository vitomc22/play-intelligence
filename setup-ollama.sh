#!/bin/bash

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Setup - Inicia Ollama + Qwen no Docker e instala Aider
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

set -e

echo "╔════════════════════════════════════════════════════════╗"
echo "║  Playwright Intelligence - Setup Ollama + Aider        ║"
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

# ─── Inicia Ollama ─────────────────────────────────────────
echo "📦 Iniciando Ollama em Docker..."
echo "   (Primeira execução: fará pull de ~3GB)"
echo ""

if docker compose up -d ollama; then
    echo "✅ Container Ollama iniciado"
else
    echo "❌ Erro ao iniciar container"
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

# ─── Baixa modelo gemma4:e2b ─────────────────────────────────────
echo "🤖 Baixando gemma4:e2b..."
echo "   (Primeira vez: ~5GB, pode levar 10-20 min)"
echo ""

if docker exec playwright-ollama ollama pull gemma4:e2b; then
    echo ""
    echo "✅ gemma4:e2b baixado!"
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
    "model": "gemma4:e2b",
    "messages": [{"role": "user", "content": "oi"}],
    "stream": false
  }' | grep -q "assistant"; then
    echo "✅ Ollama respondendo corretamente!"
else
    echo "⚠️  Resposta inesperada. Verifique com: curl http://localhost:11434/api/tags"
fi

echo ""

# ─── Instala Aider ─────────────────────────────────────────
echo "🔧 Verificando/Instalando Aider..."

if type aider > /dev/null 2>&1; then
    echo "✅ Aider já está instalado: $(aider --version 2>/dev/null || echo 'versão desconhecida')"
else
    echo "📦 Instalando aider-chat via pip..."
    
    if type pipx > /dev/null 2>&1; then
        echo "   Usando pipx (isolado)..."
        pipx install aider-chat
    elif type pip > /dev/null 2>&1; then
        echo "   Usando pip..."
        pip install --user aider-chat
    elif type pip3 > /dev/null 2>&1; then
        echo "   Usando pip3..."
        pip3 install --user aider-chat
    else
        echo "⚠️  pip/pipx não encontrado!"
        echo "   Instale manualmente: pip install aider-chat"
        echo "   Ou: pipx install aider-chat"
    fi
    
    # Verifica se instalou
    if type aider > /dev/null 2>&1; then
        echo "✅ Aider instalado com sucesso!"
    else
        echo "⚠️  Aider pode ter sido instalado mas não está no PATH"
        echo "   Tente adicionar ~/.local/bin ao PATH:"
        echo '   export PATH="$HOME/.local/bin:$PATH"'
    fi
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
echo "  4. 🆕 Corrigir testes automaticamente (Aider):"
echo "     npm run ai:heal"
echo ""
echo "📋 Comandos úteis:"
echo ""
echo "  Ver status:      docker compose ps"
echo "  Ver logs Ollama: docker logs playwright-ollama -f"
echo "  Parar tudo:      docker compose down"
echo "  Reiniciar:       docker compose restart"
echo ""
echo "🌐 Interfaces:"
echo ""
echo "  Ollama API: http://localhost:11434"
echo ""
echo "📚 Documentação:"
echo "  • ARQUITETURA.md - Explicação completa do projeto"
echo "  • src/healer/README.md - Guia de uso do Healer"
echo ""
