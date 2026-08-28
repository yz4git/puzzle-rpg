from pathlib import Path

p = Path("scripts/pass37_soak_qa.mjs")
s = p.read_text()

old_hold = '''const up = page.getByRole("button", { name: "Move up" });
await up.dispatchEvent("pointerdown", { pointerId: 900, pointerType: "touch", isPrimary: true, buttons: 1 });
await page.waitForTimeout(220);
const withHold = await intervalCount();
await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
await page.waitForTimeout(80);
const afterPageHide = await intervalCount();
if (afterPageHide >= withHold) throw new Error(`pagehide did not release held movement: held=${withHold} after=${afterPageHide}`);
await up.dispatchEvent("pointerup", { pointerId: 900, pointerType: "touch", isPrimary: true, buttons: 0 });
'''
new_hold = '''const up = page.getByRole("button", { name: "Move up" });
const upBox = await up.boundingBox();
if (!upBox) throw new Error("Move up button has no touchable bounds");
const cdp = await page.context().newCDPSession(page);
const touchPoint = { x: upBox.x + upBox.width / 2, y: upBox.y + upBox.height / 2, radiusX: 2, radiusY: 2, force: 1 };
await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [touchPoint] });
await page.waitForTimeout(220);
const withHold = await intervalCount();
if (withHold <= fieldBaseline) throw new Error(`real touch hold did not create repeat interval: baseline=${fieldBaseline} held=${withHold}`);
await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pagehide")));
await page.waitForTimeout(80);
const afterPageHide = await intervalCount();
if (afterPageHide >= withHold) throw new Error(`pagehide did not release held movement: baseline=${fieldBaseline} held=${withHold} after=${afterPageHide}`);
await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
'''
if old_hold not in s:
    raise SystemExit("pass37 real-touch hold anchor missing")
s = s.replace(old_hold, new_hold, 1)

old_moves = '''for (let i = 0; i < 120; i += 1) {
  const button = i % 2 ? left : right;
  const pointerId = 1000 + i;
  await button.dispatchEvent("pointerdown", { pointerId, pointerType: "touch", isPrimary: true, buttons: 1 });
  await button.dispatchEvent("pointerup", { pointerId, pointerType: "touch", isPrimary: true, buttons: 0 });
}
'''
new_moves = '''for (let i = 0; i < 120; i += 1) {
  const button = i % 2 ? left : right;
  await button.tap();
}
'''
if old_moves not in s:
    raise SystemExit("pass37 tap soak anchor missing")
s = s.replace(old_moves, new_moves, 1)

p.write_text(s)
