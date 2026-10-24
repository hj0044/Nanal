import { expect, test } from "@playwright/test";

for (const width of [320, 375, 390, 430]) {
  test(`mobile ${width}px: create, navigate, inspect relationship`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: /추천 설정 만들기/ }).click();
    await page.getByRole("button", { name: /이 설정으로 시작/ }).click();
    await expect(page.getByRole("navigation", { name: "주요 메뉴" })).toBeVisible();
    await expect(page.getByRole("button", { name: "홈으로" })).toBeVisible();
    await expect(page.getByText("오늘은 어떻게 보낼까요?")).toBeVisible();
    await page.getByRole("navigation", { name: "주요 메뉴" }).getByText("인물", { exact: true }).click();
    await page.getByRole("searchbox", { name: "인물 찾기" }).fill("김");
    await page.getByRole("searchbox", { name: "인물 찾기" }).fill("");
    const favorite = page.getByRole("button", { name: /즐겨찾기$/ }).first();
    await favorite.click();
    await expect(page.getByText(/즐겨찾기 1명/)).toBeVisible();
    await page.getByRole("button", { name: /상세 정보 열기/ }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "상세 정보 닫기" }).click();
    await page.getByRole("button", { name: "홈으로" }).click();
    await expect(page.getByText("오늘은 어떻게 보낼까요?")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`home-${width}.png`), fullPage: true });
  });
}

test("WebKit: safe areas, keyboard search and modal remain operable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "webkit-iphone");
  await page.goto("/");
  await page.getByRole("button", { name: /추천 설정 만들기/ }).click();
  await page.getByRole("button", { name: /이 설정으로 시작/ }).click();
  await page.getByRole("navigation", { name: "주요 메뉴" }).getByText("인물", { exact: true }).click();
  const search = page.getByRole("searchbox", { name: "인물 찾기" });
  await search.focus();
  await search.fill("김");
  await expect(search).toBeVisible();
  await search.fill("");
  await page.getByRole("button", { name: /상세 정보 열기/ }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: testInfo.outputPath("webkit-person-modal.png"), fullPage: true });
});
