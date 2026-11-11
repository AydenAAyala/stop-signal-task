"""End-to-end test: runs a simulated participant through a shortened copy of the task.

Requires:  pip install playwright  &&  playwright install chromium
Run from the repository root:  python tests/run_simulation.py

The copy uses 2 blocks and shorter waits so the run takes about 4 minutes.
It checks that the session completes without errors, both files download,
both staircases converge near P(respond | signal) = 0.5, and the
ANTI staircase settles at longer SSDs than PRO (the bot is slower on ANTI).
"""
import asyncio
import csv
import sys
import tempfile
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent
TESTS = Path(__file__).resolve().parent

SPEEDUPS = {
    "fixationMs: 500,": "fixationMs: 150,",
    "foreperiodMinMs: 500,": "foreperiodMinMs: 150,",
    "foreperiodMaxMs: 1000,": "foreperiodMaxMs: 300,",
    "itiMs: 500 ": "itiMs: 150 ",
    "mainBlocks: 5,": "mainBlocks: 2,",
}


def make_fast_copy(out_dir: Path) -> Path:
    src = (ROOT / "index.html").read_text(encoding="utf-8")
    for old, new in SPEEDUPS.items():
        if old not in src:
            sys.exit(f"Could not find '{old}' in index.html. Update SPEEDUPS to match CONFIG.")
        src = src.replace(old, new)
    path = out_dir / "fast.html"
    path.write_text(src, encoding="utf-8")
    return path


def read_summary(path: Path) -> dict:
    with open(path, newline="", encoding="utf-8") as f:
        return {row["metric"]: row["value"] for row in csv.DictReader(f)}


async def run(out_dir: Path) -> dict:
    page_path = make_fast_copy(out_dir)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 900}, accept_downloads=True)
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        await page.goto(page_path.as_uri())
        await page.fill("#pid", "SIM01")
        await page.fill("#age", "20")
        await page.select_option("#gender", "Other")
        await page.click("#continueBtn")
        await page.add_script_tag(path=str(TESTS / "simulated_participant.js"))
        await page.click("#practiceBtn")
        await page.wait_for_selector("#endScreen:not([hidden])", timeout=15 * 60 * 1000)

        for button, name in [("#downloadTrialsBtn", "trials.csv"), ("#downloadSummaryBtn", "summary.csv")]:
            async with page.expect_download() as d:
                await page.click(button)
            await (await d.value).save_as(out_dir / name)

        await browser.close()

    if errors:
        sys.exit(f"Page errors: {errors}")
    return read_summary(out_dir / "summary.csv")


def main():
    with tempfile.TemporaryDirectory() as tmp:
        s = asyncio.run(run(Path(tmp)))

    failures = []
    for rule in ("pro", "anti"):
        p = float(s[f"{rule}_p_respond_given_signal"])
        print(f"{rule}: p(respond|signal)={p:.3f}  mean SSD={s[f'{rule}_mean_ssd']}  "
              f"SSRT={s[f'{rule}_ssrt_integration']}  race check={s[f'{rule}_race_check_passed']}")
        if not 0.3 <= p <= 0.7:
            failures.append(f"{rule} staircase did not converge (p={p:.3f})")
    if float(s["anti_mean_ssd"]) <= float(s["pro_mean_ssd"]):
        failures.append("ANTI mean SSD should exceed PRO mean SSD for this bot")

    if failures:
        sys.exit("FAILED: " + "; ".join(failures))
    print("PASSED")


if __name__ == "__main__":
    main()
