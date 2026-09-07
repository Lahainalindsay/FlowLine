import { expect, test } from '@playwright/test';
import { clerk } from '@clerk/testing/playwright';

const clerkApi = 'https://api.clerk.com/v1';

async function clerkRequest(path: string, init: RequestInit) {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) throw new Error('CLERK_SECRET_KEY is required for the isolated regression identity.');

  const response = await fetch(`${clerkApi}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${secretKey}`,
      'content-type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Clerk ${init.method ?? 'GET'} ${path} failed (${response.status}): ${await response.text()}`);
  }
  return response;
}

test('authenticated release candidate remains operational', async ({ page, baseURL }) => {
  test.setTimeout(180_000);
  const runId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `stagetime-regression-${runId}@example.com`;
  const eventName = `Regression Production ${runId}`;
  const cueName = `Regression Cue ${runId}`;
  let clerkUserId: string | undefined;
  let eventId: string | undefined;
  let invitationId: string | undefined;
  let invitationRevoked = false;
  const forbiddenBillingRequests: string[] = [];
  const failedApiResponses: string[] = [];
  const pageErrors: string[] = [];
  let recordFailures = false;

  page.on('pageerror', error => {
    if (recordFailures) pageErrors.push(error.message);
  });
  page.on('request', req => {
    const url = req.url();
    if (
      (req.method() === 'POST' && /\/api\/billing\/(checkout|portal)(?:\?|$)/.test(url)) ||
      url.startsWith('https://checkout.stripe.com/')
    ) {
      forbiddenBillingRequests.push(`${req.method()} ${url}`);
    }
  });
  page.on('response', response => {
    if (!recordFailures || response.status() < 400) return;
    const url = new URL(response.url());
    if (baseURL && url.origin === new URL(baseURL).origin && url.pathname.startsWith('/api/')) {
      failedApiResponses.push(`${response.status()} ${response.request().method()} ${url.pathname}`);
    }
  });

  try {
    const health = await page.request.get('/api/healthz');
    expect(health.ok(), 'release-candidate API preflight').toBeTruthy();

    const createdUser = await clerkRequest('/users', {
      method: 'POST',
      body: JSON.stringify({
        email_address: [email],
        first_name: 'StageTime',
        last_name: 'Regression',
        skip_password_checks: true,
        skip_password_requirement: true,
      }),
    });
    const user = await createdUser.json() as { id: string };
    clerkUserId = user.id;

    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/');
    await clerk.signIn({ page, emailAddress: email });
    await page.goto('/');
    recordFailures = true;

    for (const label of ['Live Control', 'Events', 'Templates', 'Team', 'Billing', 'Settings']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }

    await page.goto('/events/new');
    await page.getByPlaceholder('e.g. Global Tech Summit 2024').fill(eventName);
    await page.locator('input[type="date"]').fill(new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
    await page.getByPlaceholder('e.g. Main Hall, Moscone Center').fill('Automated Release Check');
    const createdEventResponse = page.waitForResponse(
      response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/events',
    );
    await page.getByRole('button', { name: 'Provision Workspace' }).click();
    const eventResponse = await createdEventResponse;
    expect(eventResponse.status()).toBe(201);
    const event = await eventResponse.json() as { id: string };
    eventId = event.id;
    await expect(page).toHaveURL(new RegExp(`/events/${eventId}$`));
    await expect(page.getByRole('heading', { name: eventName })).toBeVisible();

    await page.getByRole('button', { name: /Run of Show/ }).click();
    await page.getByRole('button', { name: 'Add Block' }).click();
    await page.getByPlaceholder('e.g. Welcome Address').fill(cueName);
    await page.getByPlaceholder('e.g. Jane Doe').fill('Test Operator');
    await page.locator('input[type="number"]').fill('5');
    await page.getByRole('button', { name: 'Add Block', exact: true }).click();
    await expect(page.getByText(cueName, { exact: false }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Live Control' }).click();
    await expect(page.getByText(cueName, { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.getByText(/RUNNING|On Air/, { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Pause' }).click();
    await expect(page.getByText('PAUSED', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByRole('heading', { name: 'Reset Timer' })).toBeVisible();
    await page.getByRole('button', { name: 'Reset', exact: true }).last().click();
    await expect(page.getByText('IDLE', { exact: true }).first()).toBeVisible();

    await page.getByRole('link', { name: /Preview/ }).click();
    await expect(page).toHaveURL(new RegExp(`/events/${eventId}/display/[^/]+$`));
    await expect(page.getByText(cueName, { exact: false }).first()).toBeVisible();

    await page.goto('/team');
    for (const heading of ['Active Members', 'Pending Invitations', 'Invite Member']) {
      await expect(page.getByText(heading, { exact: true }).first()).toBeVisible();
    }
    const inviteEmail = `stagetime-crew-${runId}@example.com`;
    await page.getByPlaceholder('crew@example.com').fill(inviteEmail);
    await page.locator('select').last().selectOption('VIEWER');
    const invitationResponsePromise = page.waitForResponse(
      response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/team/invitations',
    );
    await page.getByRole('button', { name: 'Send Invite' }).click();
    const invitationResponse = await invitationResponsePromise;
    expect(invitationResponse.status()).toBe(201);
    invitationId = ((await invitationResponse.json()) as { id: string }).id;
    const invitationRow = page.getByText(inviteEmail).locator('..').locator('..');
    await invitationRow.getByRole('button', { name: 'Revoke' }).click();
    await expect(invitationRow.getByRole('button', { name: 'Revoked' })).toBeVisible();
    invitationRevoked = true;

    await page.goto('/billing');
    for (const text of ['Current Plan:', 'Active Events', 'Templates', 'Members']) {
      await expect(page.getByText(text, { exact: text !== 'Current Plan:' }).first()).toBeVisible();
    }
    await page.goto('/settings');
    for (const text of ['Workspace Settings', 'Team Profile', 'Billing & Plan', 'Save Changes']) {
      await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
    }
    await expect(page.locator('input').first()).toHaveValue('Production Crew');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByTestId('button-open-navigation').click();
    for (const label of ['Live Control', 'Events', 'Templates', 'Team', 'Billing', 'Settings', 'Sign out']) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
    await page.getByText('Events', { exact: true }).first().click();
    await expect(page.getByTestId('button-open-navigation')).toBeVisible();

    expect(forbiddenBillingRequests).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(failedApiResponses).toEqual([]);
  } finally {
    recordFailures = false;
    if (invitationId && !invitationRevoked) {
      await page.request.post(`/api/team/invitations/${invitationId}/revoke`, { timeout: 10_000 }).catch(() => undefined);
    }
    if (eventId) {
      const deleted = await page.request.delete(`/api/events/${eventId}`, { timeout: 10_000 });
      expect([204, 404]).toContain(deleted.status());
      expect((await page.request.get(`/api/events/${eventId}`, { timeout: 10_000 })).status()).toBe(404);
    }
    if (clerkUserId) {
      await clerkRequest(`/users/${clerkUserId}`, { method: 'DELETE' });
    }
  }
});