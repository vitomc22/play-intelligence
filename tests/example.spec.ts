import { test, expect } from '@playwright/test';

/**
 * Navigate to the application root before each test case.
 */
test.beforeEach(async ({ page }) => {
  // Usar waitUntil: 'domcontentloaded' para garantir que o DOM esteja carregado antes de interagir.
  await page.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
});


test('Create a new food', async ({ page }) => {

  // Esperar o elemento aparecer antes de clicar, melhorando a robustez contra problemas de timing.
  await test.step('Click on add product button', async () => {
    // Usar waitFor para garantir que o botão esteja visível e clicável.
    await page.getByRole('button', { name: 'Novo' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Novo' }).click();
  });


  await test.step('Fill form and submit', async () => {
    // Esperar o campo de texto aparecer antes de preencher.
    const inputField = page.getByRole('textbox').first();
    await inputField.waitFor({ state: 'visible' });
    await inputField.fill('pinga');

    await page.getByRole('textbox').nth(1).fill('25');
    await page.getByRole('textbox').nth(2).fill('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSdv6BytJ3dQHaER1WDPtetp9cInH82JsRmkQ&s');
    
    // Esperar o botão de submissão e clicar.
    await page.getByRole('button', { name: 'Submit' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'Submit' }).click();
  });


  await test.step('Check if food is visible', async () => {
    // Esperar o conteúdo ser atualizado após a submissão.
    await page.waitForLoadState('domcontentloaded');
    
    // Usar expect com espera implícita para garantir que os elementos estejam presentes.
    await expect(page.getByRole('heading', { name: 'pinga' })).toBeVisible();
    await expect(page.getByText('Valor:')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Excluir' })).toBeVisible();
  });
});
