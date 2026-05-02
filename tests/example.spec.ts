import { test, expect } from '@playwright/test';

/**
 * Navigate to the application root before each test case.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:5173/');
})


test('Create a new food', async ({ page }) => {

  await test.step('Click on add product button', async () => {
    await page.getByRole('button', { name: 'Novo' }).click();
  });


  await test.step('Fill form and submit', async () => {
    await page.getByRole('textbox').first().fill('pinga');
    await page.getByRole('textbox').nth(1).fill('25');
    await page.getByRole('textbox').nth(2).fill('https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSdv6BytJ3dQHaER1WDPtetp9cInH82JsRmkQ&s');
    await page.getByRole('button', { name: 'Submit' }).click();
  });

  await test.step('Check if food is visible', async () => {
    await page.reload();
    // Correção para Padrão 1: Usar .first() para selecionar um único elemento, evitando violação do modo estrito.
    await expect(page.getByRole('heading', { name: 'pinga' }).first()).toBeVisible();
    
    // As asserções subsequentes foram mantidas, mas agora dependem de um estado mais estável.
    await expect(page.getByText('Valor:')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Excluir' })).toBeVisible();
  });
});
