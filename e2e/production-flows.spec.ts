import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const adminEmail = process.env.E2E_ADMIN_EMAIL;
const adminPassword = process.env.E2E_ADMIN_PASSWORD;
const publisherEmail = process.env.E2E_PUBLISHER_EMAIL;
const publisherPassword = process.env.E2E_PUBLISHER_PASSWORD;
const inviteeEmail = process.env.E2E_INVITEE_EMAIL;
const inviteePassword = process.env.E2E_INVITEE_PASSWORD;

let checkoutUrl = '';
let territoryName = '';

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

async function selectActiveTerritory(page: Page, name: string) {
  const selector = page.getByRole('combobox', { name: 'Active territory' });
  await expect(selector).toBeVisible();
  await selector.click();
  await page.getByRole('option', { name }).click();
}

test.describe('staging production journeys', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(
    !adminEmail || !adminPassword || !publisherEmail || !publisherPassword,
    'Synthetic staging admin and publisher credentials are required.',
  );

  test('overseer creates, imports, recovers a boundary conflict, and issues a secure QR', async ({ page }) => {
    await signIn(page, adminEmail!, adminPassword!);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /good to see you/i })).toBeVisible();

    territoryName = `E2E Territory ${Date.now()}`;
    await page.goto('/dashboard/territories/new');
    await page.getByLabel('Name').fill(territoryName);
    const canvas = page.locator('.mapboxgl-canvas');
    await expect(canvas).toBeVisible();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Map canvas has no bounds.');
    await canvas.click({ position: { x: box.width * 0.35, y: box.height * 0.35 } });
    await canvas.click({ position: { x: box.width * 0.65, y: box.height * 0.35 } });
    await canvas.click({ position: { x: box.width * 0.65, y: box.height * 0.65 } });
    await canvas.dblclick({ position: { x: box.width * 0.35, y: box.height * 0.65 } });
    await page.getByRole('button', { name: /create territory/i }).click();
    await expect(page).toHaveURL(/\/dashboard\/territories\//);

    await page.getByRole('tab', { name: /boundary & details/i }).click();
    await page.getByLabel('Description').fill('Synthetic conflict recovery check');
    await page.route('**/api/territories/**', async (route) => {
      if (route.request().method() !== 'PUT') return route.continue();
      return route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'CONFLICT',
            message: 'This territory changed on the server. Refresh and reapply your boundary.',
          },
          requestId: crypto.randomUUID(),
        }),
      });
    });
    await page.getByRole('button', { name: 'Save territory' }).click();
    await expect(page.getByRole('alert')).toContainText(/refresh and reapply/i);
    await page.unroute('**/api/territories/**');

    await page.getByRole('tab', { name: /csv import/i }).click();
    await page.locator('#house-csv').setInputFiles({
      name: 'synthetic-houses.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('address,latitude,longitude,notes\n10 Synthetic Lane,51.5000,-0.1200,E2E callable house\n'),
    });
    await expect(page.getByRole('heading', { name: /review 1 import row/i })).toBeVisible();
    await page.getByRole('button', { name: 'Import 1 houses' }).click();
    await page.getByRole('tab', { name: /houses/i }).click();
    await expect(page.getByText('10 Synthetic Lane')).toBeVisible();

    await page.goto('/dashboard/members');
    await expect(page.getByRole('heading', { name: /membership is invite-only/i })).toBeVisible();
    await page.goto('/dashboard/reports');
    await expect(page.getByRole('button', { name: /territories/i })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    await page.goto('/dashboard/assignments');
    const territoryCard = page.locator('[data-slot="card"]').filter({ hasText: territoryName }).first();
    await expect(territoryCard).toBeVisible();
    await territoryCard.getByRole('button', { name: 'Secure QR' }).click();
    const checkoutResponse = page.waitForResponse(
      (response) => response.url().includes('/api/checkout-links')
        && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /generate one-time link/i }).click();
    const checkoutBody = await (await checkoutResponse).json() as {
      checkoutLink: { url: string };
    };
    checkoutUrl = checkoutBody.checkoutLink.url;
    await expect(page.getByRole('button', { name: /copy link/i })).toBeVisible();
  });

  test('publisher redeems QR, records visits offline, reconnects, returns, and clears local data', async ({ page, context }) => {
    expect(checkoutUrl).toMatch(/\/checkout\?token=/);
    await page.goto(checkoutUrl);
    await expect(page.getByRole('heading', { name: /secure territory checkout/i })).toBeVisible();
    await page.getByRole('button', { name: 'Sign in to continue' }).click();
    await page.getByLabel('Email address').fill(publisherEmail!);
    await page.getByRole('textbox', { name: 'Password' }).fill(publisherPassword!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/checkout\?token=/);
    await page.getByRole('button', { name: 'Check out to me' }).click();
    await expect(page.getByRole('heading', { name: 'Territory checked out' })).toBeVisible();
    await expect(page).toHaveURL(/\/field/, { timeout: 15_000 });

    await selectActiveTerritory(page, territoryName);
    await page.getByRole('tab', { name: 'List' }).click();
    await page.getByRole('button', { name: 'Record visit' }).first().click();
    await page.getByRole('combobox', { name: 'Outcome' }).click();
    await page.getByRole('option', { name: 'Return visit' }).click();
    await page.getByLabel('Follow-up date and time').fill('2026-12-01T10:00');
    await page.getByLabel('Notes or transcript').fill('Synthetic E2E follow-up');
    await page.getByRole('button', { name: 'Save visit' }).click();
    await expect(page.getByText(/append-only history/i)).toBeVisible();
    await page.goto('/field/return-visits');
    await expect(page.getByText('Synthetic E2E follow-up')).toBeVisible();

    await page.goto('/field');
    await selectActiveTerritory(page, territoryName);
    await page.getByRole('tab', { name: 'List' }).click();
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await selectActiveTerritory(page, territoryName);
    await page.getByRole('tab', { name: 'List' }).click();
    await page.getByRole('button', { name: 'Record visit' }).first().click();
    await page.getByRole('button', { name: 'Save visit' }).click();
    await expect(page.getByText(/queued for synchronization/i)).toBeVisible();
    await context.setOffline(false);
    await page.getByRole('button', { name: /offline|queued|sync issue/i }).click();
    await page.getByRole('button', { name: 'Sync now' }).click();
    await expect(page.getByRole('button', { name: /synced/i })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Return territory' }).click();
    await expect(page.getByText('Territory returned.')).toBeVisible();
    await page.goto('/field/settings');
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);
    const databaseNames = await page.evaluate(async () =>
      (await indexedDB.databases()).map((database) => database.name),
    );
    expect(databaseNames.filter((name) => name?.startsWith('territory_mapper_'))).toEqual([]);
  });

  test('invitation is accepted once by an authenticated invitee', async ({ page }) => {
    test.skip(!inviteeEmail || !inviteePassword, 'A synthetic identity without an active membership is required.');
    await signIn(page, adminEmail!, adminPassword!);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto('/dashboard/members');
    await page.getByRole('button', { name: 'Invite member' }).click();
    await page.getByLabel('Email').fill(inviteeEmail!);
    const inviteResponse = page.waitForResponse(
      (response) => response.url().endsWith('/api/invites')
        && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Send invitation' }).click();
    const inviteBody = await (await inviteResponse).json() as { acceptUrl: string };
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto(inviteBody.acceptUrl);
    await expect(page.getByRole('heading', { name: 'Congregation invitation' })).toBeVisible();
    await page.getByRole('link', { name: 'Sign in to continue' }).click();
    await page.getByLabel('Email address').fill(inviteeEmail!);
    await page.getByRole('textbox', { name: 'Password' }).fill(inviteePassword!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('button', { name: 'Accept invitation' })).toBeVisible();
    await page.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(page.getByText('Invitation accepted')).toBeVisible();
    await expect(page).toHaveURL(/\/field/, { timeout: 15_000 });
  });
});
