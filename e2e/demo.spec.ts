import { expect, test, type Page } from "@playwright/test";

// The demo story from docs/11, end to end in a real browser.
async function snap(page: Page, name: string) {
  const dir = process.env.SHOTS_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${test.info().project.name}-${name}.png`, fullPage: true });
}

async function signInAs(page: Page, name: string) {
  await page.goto("/");
  const switcher = page.getByRole("button", { name: "Switch account" });
  if (await switcher.isVisible()) {
    await switcher.click();
    await expect(page.getByRole("heading", { name: "Choose a demo account" })).toBeVisible();
  }
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await expect(page.getByRole("button", { name: "Switch account" })).toBeVisible();
}

async function startReport(page: Page, category: string, text: string) {
  await page.goto("/cases/new");
  await page.getByText(category, { exact: true }).click();
  await page.getByLabel("Which home?").selectOption({ label: "House 18" });
  await page.getByLabel("What happened?").fill(text);
  await page.getByRole("button", { name: "Send to the mediator" }).click();
}

test.beforeEach(async ({ page }) => {
  await signInAs(page, "Farah");
  await page.request.post("/api/demo/reset");
});

test("complete AI-mediated resolution and escalation", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choose a demo account" })).toBeVisible();
  await snap(page, "00-sign-in");

  // 1. House 39 reports House 18's parking with emotional wording.
  await signInAs(page, "Daniel Lim");
  await snap(page, "01-reporter-home");
  await page.goto("/cases/new");
  await snap(page, "02-new-concern");
  await startReport(page, "Parking", "House 18 keeps parking in front of my gate!! So rude. It's House 39's gate, I can't get my car out.");

  // 2. Neutral notice + privacy check; nothing sent without explicit approval.
  await expect(page.getByRole("heading", { name: "Review exactly what will be sent" })).toBeVisible();
  const theirs = page.locator("section", { has: page.getByRole("heading", { name: "What House 18 will see" }) });
  await expect(theirs).toContainText("a vehicle reportedly obstructing access to a nearby entrance");
  await expect(theirs).toContainText("difficult for a neighbour to get their vehicle in or out");
  await expect(theirs).not.toContainText("House 39");
  const approve = page.getByRole("button", { name: "Approve and send" });
  await expect(approve).toBeDisabled();
  await page.waitForTimeout(1500); // let the strike-through finish for the screenshot
  await snap(page, "03-review-notice");
  const parkingUrl = page.url();
  await page.getByRole("checkbox").check();
  await approve.click();
  await expect(page.getByText("Waiting for their reply").first()).toBeVisible();
  await snap(page, "04-sent");

  // 3. House 18 receives it privately and proposes an action.
  await signInAs(page, "Nur Aisyah");
  await snap(page, "05-recipient-home");
  await page.goto(parkingUrl);
  await expect(page.getByText("This is a reported concern, not a confirmed violation")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("House 39");
  await expect(page.locator("main")).not.toContainText("Daniel");
  await page.getByRole("radio", { name: "Say what you'll do" }).click();
  await page.getByPlaceholder("Write your reply…").fill("Sorry! My son parked there. I'll make sure entrances stay clear.");
  await page.getByRole("button", { name: "Preview what will be shared" }).click();
  await expect(page.getByLabel("Summary to share")).toHaveValue(/someone in their household parked there\. They said they'll make sure entrances stay clear/);
  await snap(page, "06-recipient-preview");
  await page.getByRole("button", { name: "Share this summary" }).click();
  await expect(page.getByText("Reply shared, waiting for neighbour").first()).toBeVisible();

  // 4. House 39 sees only the summary and confirms resolution.
  await signInAs(page, "Daniel Lim");
  await page.goto(parkingUrl);
  await expect(page.getByText("They said they'll make sure entrances stay clear")).toBeVisible();
  await expect(page.locator("main")).not.toContainText("My son");
  await snap(page, "07-reporter-relay");
  await page.getByRole("button", { name: "Yes, it's sorted" }).click();
  await expect(page.getByText("Resolved").first()).toBeVisible();

  // 5. Separate noise case: marking it unresolved makes the 3rd qualifying incident.
  await page.goto("/");
  await page.getByRole("link", { name: /They replied\. Is it sorted\?/ }).click();
  await page.getByRole("button", { name: "Not resolved yet" }).click();
  await expect(page.getByText("With community management").first()).toBeVisible();

  // 6. The recipient sees a clear status, not vague jargon.
  await signInAs(page, "Nur Aisyah");
  await snap(page, "08-recipient-home-after");

  // 7. A resident can't open someone else's case by URL (T16).
  await signInAs(page, "Priya Raman");
  await page.goto(parkingUrl);
  await expect(page.getByRole("heading", { name: "You don't have access to this" })).toBeVisible();

  // 8. Manager sees a review flag (not a penalty) and records a human decision.
  await signInAs(page, "Farah");
  await expect(page).toHaveURL(/\/manager/);
  await snap(page, "09-manager-queue");
  await page.getByRole("link", { name: /3 qualifying unresolved incidents/ }).click();
  await expect(page.getByText("3 of 3 unresolved incidents needed for review")).toBeVisible();
  await expect(page.locator("figure").getByText("×2").first()).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Daniel");
  await snap(page, "10-manager-detail");
  await page.getByLabel(/Send management advisory/).check();
  await page.getByLabel("Rationale").fill("Three separate late-night noise concerns remain unresolved; a reminder of quiet hours is appropriate.");
  await page.getByLabel("Rule or policy applied").fill("Demo Park house rules, section 4 (synthetic)");
  await page.getByRole("button", { name: "Record decision" }).click();
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();

  // 9. Demo clock: the unanswered pet concern becomes overdue after one more day.
  await expect(page.getByText("Unresolved after 7 days")).toHaveCount(0);
  await page.getByRole("button", { name: "Advance 1 day" }).click();
  await expect(page.getByText("Unresolved after 7 days")).toBeVisible();
});

test("the mediator reads intent, safety and detail", async ({ page }) => {
  await signInAs(page, "Daniel Lim");

  // Bad faith: declined, nothing drafted, reporter asked what actually happened.
  await startReport(page, "Noise", "I just want to disturb this guy life");
  await expect(page.getByRole("heading", { name: "The mediator needs a little more" })).toBeVisible();
  await expect(page.getByText("I can only pass on concerns about something specific")).toBeVisible();
  await snap(page, "11-declined");

  // Adding real detail produces a notice that carries those details.
  await page.getByLabel("Your report (private)").fill("Loud music from their garage until 2am again. We couldn't sleep.");
  await page.getByRole("button", { name: "Send to the mediator" }).click();
  const theirs = page.locator("section", { has: page.getByRole("heading", { name: "What House 18 will see" }) });
  await expect(theirs).toContainText("loud music from the garage area");
  await expect(theirs).toContainText("kept a neighbour awake");

  // Regenerate and tone produce different text.
  const first = await theirs.locator("p").first().innerText();
  await page.getByRole("button", { name: "Try another wording" }).click();
  await expect(theirs).toContainText("Version 2");
  expect(await theirs.locator("p").first().innerText()).not.toBe(first);
  await page.getByRole("radio", { name: "Formal" }).click();
  await expect(theirs).toContainText(/Dear neighbour|Dear resident|Good day/);
  await snap(page, "12-formal");

  // Possible child-welfare concern goes to a person, never to the neighbour.
  await startReport(page, "Noise", "Some loud noise in your garage. It heard like kid under 12 making some weird moan noise with old person. hmmmm sus");
  await expect(page.getByText("Not sent as a neighbour notice")).toBeVisible();
  await expect(page.getByText(/Talian Kasih on 15999/)).toBeVisible();
  await snap(page, "13-child-safety");
});
