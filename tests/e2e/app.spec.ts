import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
// Verify that browsing remains usable if the external poster CDN is unavailable.
test.beforeEach(async ({ page, context }) => {
  await context.route("https://image.tmdb.org/**", (route) => route.abort());
});
async function createRoom(page: Page) {
  await page
    .getByRole("button", { name: "Create a room", exact: true })
    .click();
  await page.getByLabel("Your name").fill("Tay");
  await page.getByLabel("Room name").fill("Friday film club");
  await page.getByRole("button", { name: "Create movie room" }).click();
  await expect(
    page.getByRole("heading", { name: "Friday film club", level: 1 }),
  ).toBeVisible();
  return (await page.locator(".room-code>span").innerText()).trim();
}
test("create, invite a second person, vote, match, change a vote, and end a room", async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("");
  const code = await createRoom(page);
  await page.getByRole("tab", { name: "Shared matches" }).click();
  await expect(
    page.getByText("Invite a friend to unlock shared matches."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "The voting room" }).click();
  const friend = await context.newPage();
  await friend.goto(`#room=${code}`);
  await friend.getByLabel("Your name").fill("Maya");
  await friend
    .getByRole("button", { name: "Join the room", exact: true })
    .click();
  await expect(
    page.locator(".member").filter({ hasText: "Maya" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "I’m in!" }).click();
  await friend.getByRole("button", { name: "I’m in!" }).click();
  await expect(
    page.getByRole("dialog", { name: "It’s a match!" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Dune: Part Two", { exact: true }),
  ).toBeVisible();
  const revealScan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(revealScan.violations).toEqual([]);
  await page
    .getByRole("button", { name: "See shared matches", exact: true })
    .click();
  await friend.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("tab", { name: "Shared matches" }).click();
  await expect(page.locator(".room-matches .movie-title")).toHaveText(
    "Dune: Part Two",
  );
  await page.getByRole("tab", { name: "The voting room" }).click();
  await page.locator(".review-votes summary").click();
  await page
    .locator(".review-votes button")
    .filter({ hasText: "Dune: Part Two" })
    .click();
  await page.getByRole("button", { name: "Pass for now" }).click();
  await page.getByRole("tab", { name: "Shared matches" }).click();
  await expect(page.locator(".room-matches .movie-card")).toHaveCount(0);
  await page.getByRole("button", { name: "End this movie room" }).click();
  await page.getByRole("button", { name: "End room", exact: true }).click();
  await friend.getByRole("tab", { name: "The voting room" }).click();
  await expect(
    friend.getByRole("heading", { name: "That’s a wrap." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
test("search, genre/runtime filtering, empty state, and country-specific demo disclosure", async ({
  page,
}) => {
  await page.goto("");
  await expect(page.locator(".movie-card")).toHaveCount(12);
  await page.getByRole("button", { name: "Comedy", exact: true }).click();
  await page.getByLabel("Maximum runtime").selectOption("120");
  await expect(page.locator(".movie-card")).toHaveCount(3);
  await page.getByLabel("Search movies").fill("no-such-movie-123");
  await expect(
    page.getByRole("heading", { name: "No films in this frame." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page.locator(".movie-card")).toHaveCount(12);
  await page
    .getByRole("button", {
      name: "Details and streaming for Dune: Part Two",
      exact: true,
    })
    .click();
  await page.getByLabel("Streaming country").selectOption("SG");
  await expect(
    page.getByText("Streaming lookup is in demo mode."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByLabel("Country", { exact: true })).toHaveValue("SG");
});
test("invalid room code displays a useful error", async ({ page }) => {
  await page.goto("#room=ZZZZZZZZ");
  await page.getByLabel("Your name").fill("Tay");
  await page
    .getByRole("button", { name: "Join the room", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Room not found in this browser",
  );
});
test("keyboard voting and native dialog focus stay accessible", async ({
  page,
}) => {
  await page.goto("");
  await page.keyboard.press("/");
  await expect(page.getByLabel("Search movies")).toBeFocused();
  const create = page.getByRole("button", {
    name: "Create a room",
    exact: true,
  });
  await create.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Your name")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(create).toBeFocused();
  await createRoom(page);
  await page.getByRole("tab", { name: "The voting room" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Shared matches" }),
  ).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await page.locator(".vote-card").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".voting-progress strong")).toHaveText("1 / 12");
  await expect(page.locator(".vote-copy h2")).toHaveText(
    "Spider-Man: Across the Spider-Verse",
  );
});
test("responsive pages have no horizontal overflow and pass accessibility checks", async ({
  page,
}) => {
  await page.goto("");
  await expect(page.locator(".movie-card")).toHaveCount(12);
  const initialViewport = page.viewportSize()!;
  for (const width of [320, 360, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `overflow at ${width}px`,
    ).toBe(true);
  }
  await page.setViewportSize(initialViewport);
  const scan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(scan.violations).toEqual([]);
  await createRoom(page);
  const roomScan = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(roomScan.violations).toEqual([]);
});

test("horizontal swipes vote while vertical scrolling does not", async ({
  page,
}) => {
  await page.goto("");
  await createRoom(page);
  const card = page.locator(".vote-card");
  async function swipe(x1: number, y1: number, x2: number, y2: number) {
    await card.evaluate(
      (element, points) => {
        const start = new Touch({
          identifier: 1,
          target: element,
          clientX: points.x1,
          clientY: points.y1,
        });
        element.dispatchEvent(
          new TouchEvent("touchstart", {
            touches: [start],
            changedTouches: [start],
            bubbles: true,
          }),
        );
        const end = new Touch({
          identifier: 1,
          target: element,
          clientX: points.x2,
          clientY: points.y2,
        });
        element.dispatchEvent(
          new TouchEvent("touchend", {
            touches: [],
            changedTouches: [end],
            bubbles: true,
          }),
        );
      },
      { x1, y1, x2, y2 },
    );
  }
  await swipe(230, 250, 240, 430);
  await expect(page.locator(".voting-progress strong")).toHaveText("0 / 12");
  await swipe(230, 250, 110, 255);
  await expect(page.locator(".voting-progress strong")).toHaveText("1 / 12");
  await swipe(110, 250, 250, 255);
  await expect(page.locator(".voting-progress strong")).toHaveText("2 / 12");
});

test("a saved shortlist persists across reloads and can be removed", async ({
  page,
}) => {
  await page.goto("");
  await page
    .getByRole("button", { name: "Save Knives Out to shortlist", exact: true })
    .click();
  await page.getByRole("button", { name: /My shortlist/ }).click();
  await expect(page.locator(".movie-grid .movie-card")).toHaveCount(1);
  await expect(page.locator(".movie-grid .movie-title")).toHaveText(
    "Knives Out",
  );
  await page.reload();
  await page.getByRole("button", { name: /My shortlist/ }).click();
  await expect(page.locator(".movie-grid .movie-title")).toHaveText(
    "Knives Out",
  );
  await page
    .getByRole("button", {
      name: "Remove Knives Out from shortlist",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Save a little movie-night inspiration.",
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Explore all films", exact: true })
    .click();
  await expect(page.locator(".movie-grid .movie-card")).toHaveCount(12);
});
test("a custom lineup survives filtering and becomes the exact room deck", async ({
  page,
}) => {
  await page.goto("");
  await page
    .getByRole("button", {
      name: "Add Dune: Part Two to movie night",
      exact: true,
    })
    .click();
  await page
    .getByRole("button", { name: "Add Arrival to movie night", exact: true })
    .click();
  await page.getByRole("button", { name: /In before midnight/ }).click();
  await expect(page.locator(".movie-grid .movie-card")).toHaveCount(5);
  await page
    .getByRole("button", { name: "Create room with 2 films", exact: true })
    .click();
  await expect(page.locator(".deck-preview")).toContainText(
    "2 films. One shared favorite.",
  );
  await page.getByLabel("Your name").fill("Tay");
  await page.getByLabel("Room name").fill("The handpicked night");
  await page
    .getByRole("button", { name: "Create movie room", exact: true })
    .click();
  await expect(page.locator(".voting-progress strong")).toHaveText("0 / 2");
  await expect(page.locator(".vote-copy h2")).toHaveText("Dune: Part Two");
  await page
    .getByRole("button", { name: "Add a demo friend", exact: false })
    .click();
  await page.getByRole("button", { name: "I’m in!" }).click();
  await expect(
    page.getByRole("dialog", { name: "It’s a match!" }),
  ).toBeVisible();
  await expect(
    page.getByText("Includes Alex’s simulated demo vote."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.locator(".vote-copy h2")).toHaveText("Arrival");
});
test("moods filter the catalog and surprise picks respect the current search", async ({
  page,
}) => {
  await page.goto("");
  await page.getByRole("button", { name: /Out of this world/ }).click();
  await expect(page.locator(".movie-grid .movie-card")).toHaveCount(5);
  await expect(page.getByLabel("Movie genre")).toHaveValue("Science Fiction");
  await page.getByRole("button", { name: /Out of this world/ }).click();
  await expect(page.locator(".movie-grid .movie-card")).toHaveCount(12);
  await page.getByLabel("Search movies").fill("The Martian");
  await expect(page.locator(".movie-grid .movie-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Surprise me", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "The Martian", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page
    .getByRole("button", { name: "Next spotlight film", exact: true })
    .click();
  await expect(page.locator(".spotlight-film strong")).toHaveText(
    "Spider-Man: Across the Spider-Verse",
  );
  await page
    .getByRole("button", { name: "Previous spotlight film", exact: true })
    .click();
  await expect(page.locator(".spotlight-film strong")).toHaveText(
    "Dune: Part Two",
  );
});
