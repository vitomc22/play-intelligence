/**
 * @fileoverview Example Playwright Test Spec.
 * Covers the "Create a new food" CRUD flow on the local development server.
 * Serves as a reference test for the {@link PlaywrightIntelligence} reporter pipeline.
 */
import { test, expect } from '@playwright/test';

/**
 * Navigate to the application root before each test case, esperando o carregamento do DOM.
 */
test.beforeEach(async ({ page }) => {
  // Usar waitUntil: 'domcontentloaded' para garantir que o DOM esteja pronto
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
});

test('Create a new food', async ({ page }) => {
  // Esperar o botão de adicionar produto aparecer antes de clicar
  await test.step('Click on add product button', async () => {
    // Usar getByRole para seletores mais robustos
    await page.getByRole('button', { name: 'Novo' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Novo' }).click();
  });

  // Esperar o formulário aparecer e preencher os campos
  await test.step('Fill form and submit', async () => {
    // Esperar o campo de texto aparecer antes de preencher
    const input1 = page.getByRole('textbox', { name: 'Nome' }); // Assumindo que o primeiro textbox é o nome
    const input2 = page.getByRole('textbox', { name: 'Quantidade' }); // Assumindo que o segundo é a quantidade
    const input3 = page.getByRole('textbox', { name: 'URL' }); // Assumindo que o terceiro é a URL

    await input1.fill('pinga');
    await input2.fill('25');
    await input3.fill('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSdv6BytJ3dQHaER1WDPtetp9cInH82JsRmkQ&s');
    
    // Esperar o botão de submeter aparecer e clicar
    await page.getByRole('button', { name: 'Submit' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Submit' }).click();
  });

  // Esperar o conteúdo ser carregado e verificar a visibilidade dos elementos
  await test.step('Check if food is visible', async () => {
    // Esperar o recarregamento e o título aparecer
    await page.reload({ waitUntil: 'networkidle' });
    
    // Usar waitFor para garantir que os elementos de resultado estejam visíveis
    await expect(page.getByRole('heading', { name: 'pinga' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Valor:')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Excluir' })).toBeVisible({ timeout: 15000 });
  });
});
