import { expect, test, type Page } from '@playwright/test';

const API_URL = 'http://localhost:4000';

/**
 * End-to-end happy path: select repository -> select branches -> start
 * review -> view completed results. Real GitHub OAuth and OpenAI calls can't
 * run in CI, so the backend is fully mocked at the network boundary — this
 * exercises the frontend's data flow and rendering, not the API/worker.
 */
async function mockApi(page: Page) {
  await page.route(`${API_URL}/api/auth/me`, (route) =>
    route.fulfill({
      json: { id: 'user-1', githubLogin: 'octocat', name: 'The Octocat', avatarUrl: null },
    }),
  );

  await page.route(`${API_URL}/api/repositories`, (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({
        json: [
          {
            githubRepoId: 1,
            owner: 'acme',
            name: 'demo-app',
            fullName: 'acme/demo-app',
            defaultBranch: 'main',
            private: false,
            isConnected: true,
            internalId: 'repo-1',
          },
        ],
      });
    }
    return route.fallback();
  });

  await page.route(`${API_URL}/api/repositories/repo-1`, (route) =>
    route.fulfill({
      json: {
        id: 'repo-1',
        owner: 'acme',
        name: 'demo-app',
        fullName: 'acme/demo-app',
        defaultBranch: 'main',
        private: false,
      },
    }),
  );

  await page.route(`${API_URL}/api/repositories/repo-1/branches`, (route) =>
    route.fulfill({
      json: [
        { name: 'main', commitSha: 'a1', protected: true },
        { name: 'feature/payment-api', commitSha: 'b2', protected: false },
      ],
    }),
  );

  await page.route(`${API_URL}/api/reviews`, (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({ status: 202, json: { id: 'review-1', status: 'pending' } });
    }
    return route.fallback();
  });

  await page.route(`${API_URL}/api/reviews/review-1`, (route) =>
    route.fulfill({
      json: {
        id: 'review-1',
        repositoryId: 'repo-1',
        repositoryFullName: 'acme/demo-app',
        baseBranch: 'main',
        headBranch: 'feature/payment-api',
        baseSha: 'a1',
        headSha: 'b2',
        status: 'completed',
        summary: 'The branch introduces payment functionality but bypasses the service layer.',
        score: 78,
        architectureScore: 65,
        securityScore: 90,
        qualityScore: 80,
        performanceScore: 85,
        testingScore: 70,
        model: 'gpt-4.1-mini',
        inputTokens: 4200,
        outputTokens: 600,
        estimatedCostUsd: 0.0027,
        errorMessage: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
    }),
  );

  await page.route(`${API_URL}/api/reviews/review-1/issues`, (route) =>
    route.fulfill({
      json: [
        {
          id: 'issue-1',
          severity: 'high',
          category: 'architecture',
          file: 'app/Http/Controllers/PaymentController.php',
          line: 45,
          title: 'Business logic inside controller',
          message: 'The controller contains business logic that should be handled by a service.',
          reason: 'Existing project architecture uses Controller -> Service -> Repository.',
          suggestion: 'Move payment processing logic to PaymentService.',
        },
      ],
    }),
  );

  await page.route(`${API_URL}/api/reviews/review-1/files`, (route) =>
    route.fulfill({
      json: [
        {
          id: 'file-1',
          filePath: 'app/Http/Controllers/PaymentController.php',
          status: 'modified',
          additions: 40,
          deletions: 5,
          patch: '@@ -1,3 +1,10 @@\n+// new payment logic',
        },
      ],
    }),
  );
}

test('golden path: repository -> branches -> start review -> results', async ({ page }) => {
  await mockApi(page);

  await page.goto('/repositories');
  await expect(page.getByText('acme/demo-app')).toBeVisible();

  await page.getByRole('link', { name: 'Open' }).click();
  await expect(page).toHaveURL(/\/repositories\/repo-1$/);

  await page.getByLabel('Feature / review branch').selectOption('feature/payment-api');
  await page.getByRole('button', { name: 'Start Review' }).click();

  await expect(page).toHaveURL(/\/reviews\/review-1$/);
  await expect(page.getByText('78', { exact: true })).toBeVisible();
  await expect(page.getByText('Business logic inside controller')).toBeVisible();
  await expect(page.getByText('Move payment processing logic to PaymentService.')).toBeVisible();
});
