import { expect, test, type Page } from "@playwright/test";

// Matches playwright.config.ts (webServer env + docs). The BFF seeds `admin`
// from OS_ADMIN_PASSWORD with must_change_password = true on first boot.
const ADMIN_PASSWORD = "e2e-pass-123";
const NEW_PASSWORD = "e2e-new-pass-123";

const NAV_ITEMS = ["对话", "智能体", "群聊", "任务", "用量"];

/**
 * Install an in-browser WebSocket stub so the chat shell can render a session
 * (and therefore its composer) without a real Hermes gateway. The BFF is the
 * only real dependency under test; the gateway is exercised by unit tests.
 * Answers the JSON-RPC calls the SPA makes on boot.
 */
async function installGatewayStub(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const RESPONSES: Record<string, unknown> = {
      "session.list": { sessions: [{ session_id: "e2e-session", title: "E2E 会话" }] },
      "commands.catalog": { commands: [] },
      "complete.slash": { completions: [] },
      "session.events.since": { requests: [] },
      "session.create": { session_id: "e2e-session" },
    };

    type Listener = ((event: unknown) => void) & { once?: boolean };

    class StubSocket {
      url: string;
      readyState = 0;
      private listeners: Record<string, Listener[]> = {};

      constructor(url: string) {
        this.url = url;
        setTimeout(() => {
          this.readyState = 1;
          this.emit("open", {});
        }, 0);
      }

      addEventListener(type: string, listener: Listener, options?: { once?: boolean }) {
        if (options?.once) {
          listener.once = true;
        }
        (this.listeners[type] ??= []).push(listener);
      }

      removeEventListener(type: string, listener: Listener) {
        const bucket = this.listeners[type];
        if (bucket) {
          this.listeners[type] = bucket.filter((entry) => entry !== listener);
        }
      }

      private emit(type: string, event: unknown) {
        for (const listener of [...(this.listeners[type] ?? [])]) {
          listener(event);
          if (listener.once) {
            this.removeEventListener(type, listener);
          }
        }
      }

      send(raw: string) {
        let frame: { id?: number; method?: string };
        try {
          frame = JSON.parse(raw);
        } catch {
          return;
        }
        if (frame && typeof frame.method === "string" && typeof frame.id === "number") {
          const result = RESPONSES[frame.method] ?? {};
          setTimeout(() => {
            this.emit("message", {
              data: JSON.stringify({ jsonrpc: "2.0", id: frame.id, result }),
            });
          }, 0);
        }
      }

      close() {
        this.readyState = 3;
        this.emit("close", {});
      }
    }

    (window as unknown as { WebSocket: unknown }).WebSocket = StubSocket;
  });
}

test("unauthenticated visit redirects to /login", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await installGatewayStub(page);

  await page.goto("/");

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();
  expect(pageErrors).toEqual([]);
});

test("login → shell → settings/agents render without errors", async ({ page }) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await installGatewayStub(page);

  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);

  await page.fill("#login-username", "admin");
  await page.fill("#login-password", ADMIN_PASSWORD);
  await page.getByRole("button", { name: "登录" }).click();

  // First login is forced through the change-password step.
  await expect(page.getByRole("heading", { name: "修改密码" })).toBeVisible();
  await page.fill("#change-new", NEW_PASSWORD);
  await page.getByRole("button", { name: "修改密码" }).click();

  // AppShell renders on the chat route.
  await expect(page).toHaveURL(/\/chat$/);
  for (const label of NAV_ITEMS) {
    await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
  }

  // Select the stubbed session so the composer is mounted.
  await page.getByRole("button", { name: "E2E 会话", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "消息" })).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "设置", exact: true })).toBeVisible();

  await page.goto("/agents");
  await expect(page.getByRole("heading", { name: "智能体", exact: true })).toBeVisible();

  expect(pageErrors).toEqual([]);
});
