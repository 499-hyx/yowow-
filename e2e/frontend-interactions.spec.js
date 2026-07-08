const { test, expect } = require("@playwright/test");

const DATE = "2026-06-29";
const EDUCATION_ACCOUNT = "acct-xiaozhu-edu-xhs";

async function denyClipboard(context) {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("clipboard denied");
        },
      },
    });
  });
}

test.describe("frontend interaction closure", () => {
  test("dashboard navigation reaches active pages", async ({ page }) => {
    await page.goto(`/?date=${DATE}`);

    await expect(page.getByRole("heading", { name: /内容决策快照/ })).toBeVisible();
    await page.getByRole("link", { name: "进入热点池" }).click();
    await expect(page).toHaveURL(/\/hotspots/);
    await expect(page.getByRole("heading", { name: /中立原料/ })).toBeVisible();

    await page.goto(`/?date=${DATE}`);
    await page.getByRole("link", { name: "新增账号" }).first().click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { name: "用问卷生成赛道记忆和账号记忆" })).toBeVisible();

    await page.getByRole("link", { name: "回今日总览" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("onboarding questionnaire updates generated JSON and copy reports success", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/onboarding");

    await page.getByLabel("这个赛道一句话叫什么？").fill("男士个护 · 剃须刀");
    await page.getByLabel("账号展示名是什么？").fill("剃须刀老板号");
    await expect(page.getByText('"display_name": "剃须刀老板号"')).toBeVisible();
    await expect(page.getByText('"track_name": "男士个护 · 剃须刀"').first()).toBeVisible();

    await page.getByRole("button", { name: "复制" }).first().click();
    await expect(page.getByRole("button", { name: "已复制" }).first()).toBeVisible();
  });

  test("copy actions show a visible failure when clipboard is unavailable", async ({ page, context }) => {
    await denyClipboard(context);
    await page.goto("/onboarding");

    await page.getByRole("button", { name: "复制" }).first().click();
    await expect(page.getByText("复制失败，请手动选中文本复制。")).toBeVisible();
  });

  test("account deletion cancel branch gives visible feedback and does not remove cards", async ({ page }) => {
    await page.goto(`/accounts?date=${DATE}`);
    const cardsBefore = await page.locator("article").count();
    expect(cardsBefore).toBeGreaterThan(0);

    page.once("dialog", async (dialog) => {
      await dialog.dismiss();
    });
    await page.getByRole("button", { name: "删除" }).first().click();

    await expect(page.getByText("已取消删除。")).toBeVisible();
    await expect(page.locator("article")).toHaveCount(cardsBefore);
  });

  test("feedback form requires scores then reports saved without mutating local files", async ({ page }) => {
    await page.route("**/api/feedback", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, feedback_id: "fb-e2e" }),
      });
    });

    await page.goto(`/account/${EDUCATION_ACCOUNT}?date=${DATE}`);
    const feedback = page.locator("details", { hasText: "只保存评分文件，不改变今天的推荐。" }).first();
    await expect(feedback.getByRole("button", { name: "保存反馈" })).toBeDisabled();

    await feedback.getByRole("button", { name: "5" }).nth(0).click();
    await feedback.getByRole("button", { name: "5" }).nth(1).click();
    await feedback.getByRole("button", { name: "5" }).nth(2).click();
    await feedback.getByRole("button", { name: "保存反馈" }).click();

    await expect(feedback.getByText("已保存到反馈收件箱")).toBeVisible();
  });

  test("memory editor supports cancel, saving state, and saved feedback", async ({ page }) => {
    let releaseSave;
    const saveMayContinue = new Promise((resolve) => {
      releaseSave = resolve;
    });

    await page.route(`**/api/accounts/${EDUCATION_ACCOUNT}/memory`, async (route) => {
      await saveMayContinue;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, memory_updated_at: "2026-06-29T00:00:00.000Z" }),
      });
    });

    await page.goto(`/account/${EDUCATION_ACCOUNT}?date=${DATE}&tab=memory`);
    const section = page.getByRole("heading", { name: "业务事实" }).locator("xpath=ancestor::section[1]");

    await section.getByRole("button", { name: "编辑" }).click();
    await expect(section.locator("textarea").first()).toBeVisible();
    await section.getByRole("button", { name: "取消" }).click();
    await expect(section.getByRole("button", { name: "编辑" })).toBeVisible();

    await section.getByRole("button", { name: "编辑" }).click();
    await section.locator("textarea").first().fill("e2e 本地测试业务");
    await section.getByRole("button", { name: "保存" }).click();
    await expect(section.getByRole("button", { name: "保存中" })).toBeDisabled();
    releaseSave();
    await expect(page.getByText("已保存，下次跑批生效。")).toBeVisible();
  });

  test("spark inbox can submit a local spark and show saved state", async ({ page }) => {
    await page.route("**/api/spark**", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ ok: true, sparks: [] }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          spark: {
            spark_id: "spark-e2e-001",
            account_id: EDUCATION_ACCOUNT,
            track_id: "education-yowow",
            text: "e2e 临时灵感",
            created_at: "2026-06-29T00:00:00.000Z",
            status: "pending",
            resolved_at: null,
            hotspot_id: null,
            reject_reason: null,
          },
        }),
      });
    });

    await page.goto(`/account/${EDUCATION_ACCOUNT}?date=${DATE}&tab=spark`);
    await page.getByPlaceholder("想到什么写什么，明天跑热点时会自动带上").fill("e2e 临时灵感");
    await page.getByRole("button", { name: "提交灵感" }).click();

    await expect(page.getByText("已收下，处理发生在每日跑热点时。")).toBeVisible();
    await expect(page.getByText("spark-e2e-001")).toBeVisible();
  });

  test("card detail copy button reports clipboard success", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`/card/${EDUCATION_ACCOUNT}/${DATE}/hs-20260629-edu-001`);

    await page.getByRole("button", { name: "复制脚本" }).click();
    await expect(page.getByRole("button", { name: "已复制" })).toBeVisible();
  });

  test("spark inbox reports load failures instead of failing silently", async ({ page }) => {
    await page.route("**/api/spark?*", async (route) => {
      await route.abort();
    });

    await page.goto(`/account/${EDUCATION_ACCOUNT}?date=${DATE}&tab=spark`);
    await expect(page.getByText("读取失败：本地服务没有响应。")).toBeVisible();
  });

  test("ops workbench is understandable for one-person GPT copy-paste operation", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.route("**/api/ops/status", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, output: "preflight ok" }),
      });
    });
    await page.route("**/api/ops/hotspot-prompts", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          prompts: {
            broad: "公共热点提示词 e2e",
            broadPrompts: [
              { id: "platform-native", title: "平台原生全网热点", text: "公共热点提示词 e2e" },
              { id: "ultimate-radar", title: "终极雷达热点", text: "终极雷达提示词 e2e" },
            ],
            search: "赛道热点提示词 e2e",
            track: { track_id: "education-yowow", track_name: "教育赛道" },
          },
        }),
      });
    });
    await page.route("**/api/ops/hotspots", async (route) => {
      const body = await route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          count: 1,
          relativePath:
            body.kind === "broad"
              ? "data/hotspots/2026-06-29.json"
              : "data/hotspots/tracks/education-yowow/2026-06-29.json",
        }),
      });
    });
    await page.route("**/api/ops/prompts", async (route) => {
      const body = await route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          output: "prompt ok",
          prompts: [
            {
              name: `${body.stage}-hs-e2e-001.txt`,
              hotspot_id: "hs-e2e-001",
              relativePath: `data/runs/${DATE}/${EDUCATION_ACCOUNT}/prompts/${body.stage}-hs-e2e-001.txt`,
              content: `${body.stage} prompt e2e`,
            },
          ],
        }),
      });
    });
    await page.route("**/api/ops/inbox", async (route) => {
      const body = await route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          files: [
            {
              relativePath: `data/runs/${DATE}/${EDUCATION_ACCOUNT}/_inbox/${body.stage}-hs-e2e-001.json`,
            },
          ],
        }),
      });
    });
    await page.route("**/api/ops/ingest", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, output: "ingest ok" }),
      });
    });

    await page.goto("/ops");
    await expect(page.getByRole("heading", { name: "每日跑批台" })).toBeVisible();
    await page.getByLabel("日期").fill(DATE);
    await expect(page.getByRole("heading", { name: "今日任务清单" })).toBeVisible();
    await expect(page.getByText("下一步：先准备今天的热点")).toBeVisible();

    await page.getByRole("button", { name: "跑前检查" }).click();
    await expect(page.getByText("preflight ok")).toBeVisible();

    await page.getByRole("button", { name: "刷新热点提示词" }).click();
    await expect(page.getByText("公共热点提示词 e2e")).toBeVisible();
    await expect(page.getByText("终极雷达提示词 e2e")).toBeVisible();
    await expect(page.getByText("赛道热点提示词 e2e")).toBeVisible();
    await expect(page.getByText("旧第三步提示词 e2e")).not.toBeVisible();
    await page.getByRole("button", { name: "复制提示词" }).first().click();
    await expect(page.getByRole("button", { name: "已复制" }).first()).toBeVisible();

    await page.getByLabel("粘贴全网热点结果").fill('[{"hotspot_id":"hs-e2e-001","title":"热点","summary":"摘要"}]');
    await page.getByRole("button", { name: "保存全网热点" }).click();
    await expect(page.getByText("已保存 1 条全网热点。")).toBeVisible();
    await expect(page.getByText("data/hotspots/2026-06-29.json")).not.toBeVisible();
    await page.getByText("查看技术路径").first().click();
    await expect(page.getByText("data/hotspots/2026-06-29.json")).toBeVisible();

    await page.getByLabel("粘贴本赛道热点结果").fill('[{"hotspot_id":"hs-e2e-edu-001","title":"赛道热点","summary":"摘要"}]');
    await page.getByRole("button", { name: "保存赛道热点" }).click();
    await expect(page.getByText("已保存 1 条赛道热点。")).toBeVisible();

    await page.getByRole("button", { name: "生成判断提示词" }).click();
    await expect(page.getByText("已生成 1 条判断提示词。现在复制给 GPT，让它判断哪些能发。")).toBeVisible();
    await expect(page.getByText("GPT 判断提示词")).toBeVisible();
    await page.getByRole("button", { name: "复制全部给 GPT" }).first().click();
    const matchClipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(matchClipboard).toContain("最终只输出一个 JSON 数组");
    expect(matchClipboard).toContain("hs-e2e-001");
    expect(matchClipboard).not.toContain("系统会自动保存到");

    await page.getByLabel("粘贴 GPT 的判断结果").fill('[{"hotspot_id":"hs-e2e-001","tier":"skip","skip_reason":"e2e"}]');
    await page.getByRole("button", { name: "保存判断结果" }).click();
    await expect(page.getByText("已保存 1 个判断结果。")).toBeVisible();

    await page.getByRole("button", { name: "生成分析+内容提示词" }).click();
    await expect(page.getByText("已生成 1 条分析+内容提示词。现在复制给 GPT，让它先分析再写内容草稿。")).toBeVisible();
    await expect(page.getByText("GPT 分析+内容提示词")).toBeVisible();
    await page.getByRole("button", { name: "复制全部给 GPT" }).nth(1).click();
    const generateClipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(generateClipboard).toContain("最终只输出一个 JSON 数组");
    expect(generateClipboard).toContain("hs-e2e-001");
    expect(generateClipboard).not.toContain("系统会自动保存到");

    await page.getByLabel("粘贴 GPT 的内容结果").fill('[{"hotspot_id":"hs-e2e-001","recommendation":"skip","skip_reason":"e2e"}]');
    await page.getByRole("button", { name: "保存内容结果" }).click();
    await expect(page.getByText("已保存 1 个内容结果。")).toBeVisible();

    await page.getByRole("button", { name: "安装到今日页面" }).click();
    await expect(page.getByText("ingest ok")).toBeVisible();
  });

  test("ops workbench shows local guidance when prompt generation lacks hotspot pools", async ({ page }) => {
    await page.route("**/api/ops/prompts", async (route) => {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          output: "❌ 错误：该日期没有任何热点池文件。请先写入热点。",
          prompts: [],
        }),
      });
    });

    await page.goto("/ops");
    await page.getByRole("button", { name: "生成判断提示词" }).click();

    const matchSection = page.getByRole("heading", { name: "2. 让 GPT 判断哪些能发" }).locator("xpath=ancestor::div[contains(@class,'space-y-3')][1]");
    await expect(matchSection.getByText("这一天还没有热点池")).toBeVisible();
    await expect(matchSection.getByText("先回到第 1 步保存全网热点或赛道热点")).toBeVisible();
  });
});
