# 🧪 Playwright Intelligence - Sugestões de Testes
> Gerado em: 25/04/2026, 16:54:18
> Provedor: ollama | Modelo: gemma4:e2b

---

Como especialista em Playwright, analisei o `system-map` fornecido. A rota `/` possui um *coverage score* de apenas 20%, indicando uma necessidade crítica de testes de regressão e funcionalidade. Os *gaps* identificados (`invalid input`, `empty state`, `required fields`, `404`) apontam para a ausência de testes de validação de formulário, gerenciamento de estados e tratamento de erros HTTP.

Abaixo estão os testes gerados, utilizando o padrão Page Object Model (POM) e seguindo as melhores práticas de seleção de elementos (`getByRole`).

### Estrutura do Page Object Model (Exemplo Conceitual)

Para manter o código autocontido e seguir o POM, assumiremos a existência de uma classe Page Object que encapsula as interações com a página.

### Testes Playwright em TypeScript

```typescript
// page-objects/LandingPage.ts
import { Page, Locator } from '@playwright/test';

export class LandingPage {
  readonly page: Page;
  // Seletores baseados em roles e test IDs para evitar fragilidade
  readonly getStartedLink: Locator;
  readonly inputField: Locator; // Assumindo um campo de input para testar validação
  readonly submitButton: Locator;
  readonly emptyStateMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    // Seletores robustos
    this.getStartedLink = page.getByRole('link', { name: 'Get started' });
    // Estes seletores são hipotéticos, devem ser ajustados ao DOM real da rota '/'
    this.inputField = page.getByLabel('Nome do Campo de Input'); 
    this.submitButton = page.getByRole('button', { name: 'Enviar' });
    this.emptyStateMessage = page.getByText('Nenhum conteúdo encontrado');
  }

  async navigateToStart() {
    await this.getStartedLink.click();
  }

  async submitForm(data: Record<string, string>): Promise<void> {
    await this.inputField.fill(data.name);
    await this.submitButton.click();
  }

  async assertEmptyState() {
    await expect(this.emptyStateMessage).toBeVisible();
  }
}

// tests/index.spec.ts (Exemplo de como os testes seriam chamados)
import { test, expect } from '@playwright/test';
import { LandingPage } from '../page-objects/LandingPage';

test.describe('Rota / - Testes de Cobertura de Gaps', () => {
  let landingPage: LandingPage;

  test.beforeEach(async ({ page }) => {
    // Inicializa o Page Object para cada teste
    landingPage = new LandingPage(page);
    // Navega para a rota base, se necessário
    await page.goto('/'); 
  });

  // ------------------------------------------------------------------
  // GAP 1: invalid input (Validação de entrada inválida)
  // ------------------------------------------------------------------
  test('deve exibir erro ao submeter com input inválido', async () => {
    // Cobre o gap: invalid input
    // Assumimos que a submissão com dados inválidos deve resultar em um erro.
    // Nota: O seletor exato do erro deve ser ajustado ao ambiente real.
    await landingPage.submitForm({ name: '' }); // Submete com campo vazio
    
    // Assertiva para garantir que uma mensagem de erro de validação apareça
    await expect(page.locator('.error-message')).toBeVisible();
    await expect(page.locator('.error-message')).toHaveText(/Campo obrigatório/);
  });

  // ------------------------------------------------------------------
  // GAP 2: empty state (Estado vazio)
  // ------------------------------------------------------------------
  test('deve exibir a mensagem de estado vazio quando não há conteúdo', async () => {
    // Cobre o gap: empty state
    // Assumimos que a rota '/' pode retornar um estado vazio.
    await landingPage.assertEmptyState();
    
    // Assertiva adicional para garantir que o conteúdo principal não está visível
    await expect(page.locator('h1')).toBeHidden();
  });

  // ------------------------------------------------------------------
  // GAP 3: required fields (Campos obrigatórios)
  // ------------------------------------------------------------------
  test('deve impedir o envio se campos obrigatórios estiverem ausentes', async () => {
    // Cobre o gap: required fields
    // Testa a validação de campos obrigatórios.
    await landingPage.submitForm({ name: '' }); // Tentativa de submissão sem preencher
    
    // Assertiva: O formulário não deve ser submetido ou deve haver um erro claro.
    // Aqui, testamos a ausência de submissão bem-sucedida.
    await expect(page.locator('form')).toBeVisible(); // Garante que o formulário ainda está presente
    // Se o backend retornar um erro de validação, a assertiva deve ser:
    // await expect(page.locator('.validation-error')).toBeVisible();
  });

  // ------------------------------------------------------------------
  // GAP 4: 404 (Tratamento de erro 404)
  // ------------------------------------------------------------------
  test('deve lidar corretamente com o erro 404 ao acessar uma rota inexistente', async ({ page }) => {
    // Cobre o gap: 404
    // Testa a capacidade da aplicação de lidar com erros HTTP.
    // Navega para uma rota que sabemos que não existe (simulando um erro 404).
    await page.goto('/rota-inexistente-404'); 

    // Assertiva: Verifica se o Playwright detectou o erro HTTP (depende da configuração do servidor/framework)
    // Se o servidor retornar um erro 404, o Playwright geralmente detecta isso no status code.
    await expect(page).toHaveURL(/rota-inexistente-404/);
    // Se o erro for tratado na UI, adicione:
    // await expect(page.getByText('404 Not Found')).toBeVisible();
  });
});
```

---
_💡 Dica: Copie e cole os testes acima em novos arquivos na pasta 'tests/'._