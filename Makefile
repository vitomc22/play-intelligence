.PHONY: help setup start stop logs health test analyze

help:
	@echo "╔═══════════════════════════════════════════════════════╗"
	@echo "║   Playwright Intelligence - Makefile                  ║"
	@echo "╚═══════════════════════════════════════════════════════╝"
	@echo ""
	@echo "Setup & Docker:"
	@echo "  make setup      - Instala tudo (Docker, Ollama, deps)"
	@echo "  make start      - Inicia Ollama em Docker"
	@echo "  make stop       - Para Ollama"
	@echo "  make logs       - Ver logs do Ollama"
	@echo "  make health     - Health check da IA"
	@echo ""
	@echo "Testes & IA:"
	@echo "  make test       - Rodar testes Playwright"
	@echo "  make analyze    - Analisar falhas com IA"
	@echo "  make suggest    - Sugerir novos testes"
	@echo "  make fragility  - Identificar testes frágeis"
	@echo ""

setup:
	@chmod +x setup-ollama.sh
	@./setup-ollama.sh
	npm install

start:
	@docker-compose up -d ollama
	@echo "✅ Ollama iniciado. Aguarde 30s e teste com: make health"

stop:
	@docker-compose down
	@echo "✅ Ollama parado"

logs:
	@docker logs playwright-ollama -f

health:
	@npm run ai:health

test:
	@npm run test:intelligence

analyze:
	@npm run ai:analyze

suggest:
	@npm run ai:suggest

fragility:
	@npm run ai:fragility

.DEFAULT_GOAL := help
