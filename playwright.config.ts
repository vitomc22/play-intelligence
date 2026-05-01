/**
 * @fileoverview Playwright Test Configuration.
 * Defines projects, reporters, browser settings, and CI-specific overrides.
 * Uses the custom {@link PlaywrightIntelligence} reporter to collect failure context and system maps.
 *
 * @see https://playwright.dev/docs/test-configuration
 */
import { defineConfig, devices } from '@playwright/test';

/**
 * Ambient declaration for the `process` global.
 * Required because this config file is evaluated outside of a Node.js type context.
 */
declare const process: { env: { CI?: string } };

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['list'],
    ['./src/reporter/index.ts'],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on',
    screenshot: 'on',
    video: 'on-first-retry',
    ignoreHTTPSErrors: true,
    viewport: null,
    launchOptions: {
      headless: false,
      args: ['--start-maximized'],
    },
    // Adicionando configurações para mitigar erros de WebKit e timeouts
    timeout: 30000, // Aumentar o timeout padrão para 30 segundos
    // Se for necessário, pode-se adicionar a configuração de navegadores aqui para excluir WebKit,
    // mas seguiremos a sugestão de aumentar o timeout e usar waits no teste.
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },


    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
