"""Check lesson links, simulation outputs, practice grading, and responsive layout."""
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright


def run(base, out):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 940}, reduced_motion="reduce")
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

        def go(route):
            page.goto(f"{base.rstrip('/')}/#{route}")
            page.wait_for_function(
                "(route) => document.querySelector('main').dataset.route === route",
                arg=route, timeout=5000,
            )

        def value(name, val):
            page.locator(f"#ctl-{name}").fill(str(val))

        def readout():
            return page.locator("#readouts").inner_text()

        go("home")
        assert page.locator(".chapter-card").count() == 3
        assert page.locator(".chapter-list li").count() == 12
        page.get_by_role("button", name="磁場軌跡").click()
        assert page.locator("#scope-link").get_attribute("href") == "#labs/particle"
        sections = page.evaluate("EM.sections.map(({id, lab}) => [id, lab])")
        assert len(sections) == len(set(i[1] for i in sections)) == 12
        for sid, lid in sections:
            go(f"course/{sid}")
            assert page.locator(".observe a").get_attribute("href") == f"#labs/{lid}"
            go(f"labs/{lid}")
            assert page.locator("#lab-plot svg").count() == 1
            assert page.locator("#readouts dd").count() >= 2
            assert not page.locator(".lab-layout").evaluate("(el) => /NaN|Infinity/.test(el.innerHTML)")

        go("course/1-1")
        page.locator("#mark").click()
        page.reload()
        assert page.locator("#mark").get_attribute("aria-pressed") == "true"
        page.locator("#mark").click()

        go("labs/coulomb")
        assert "0.3375 N" in readout()
        value("r", .8)
        assert "0.0844 N" in readout()
        page.locator("#ctl-s").select_option("1")
        assert "0.0844 N" in readout() and "互斥" in readout()
        page.get_by_role("button", name="恢復初始值").click()
        assert "0.3375 N" in readout() and "互吸" in readout()
        go("labs/field")
        value("y", 0)
        page.locator("#ctl-s").select_option("1")
        assert page.locator("#readouts dd").all_inner_texts() == ["0 N/C", "0 μN"]
        go("labs/compass")
        value("i", -6)
        assert "30 μT・向下" in readout()
        go("labs/wireforce")
        value("theta", 0)
        assert "0 N" in readout() and "無磁力" in readout()
        value("theta", 90)
        assert "0.3 N" in readout()
        go("labs/particle")
        value("theta", 90)
        assert page.locator("#readouts dd").last.inner_text() == "0 m"
        value("theta", 0)
        assert "直線運動" in readout()
        go("labs/flux")
        assert "−" not in page.locator("#readouts dd").nth(0).inner_text()
        assert "-0.6 V" in readout()
        value("dt", .5)
        assert "-1.2 V" in readout()
        value("end", .2)
        assert page.locator("#readouts dd").nth(1).inner_text() == "0 V"
        go("labs/lenz")
        assert "逆時針" in readout()
        page.locator("#ctl-move").select_option("-1")
        assert "順時針" in readout()
        page.locator("#ctl-closed").select_option("0")
        assert page.locator("#readouts dd").all_inner_texts() == ["非零", "無"]
        go("labs/generator")
        value("phase", 0)
        assert page.locator("#readouts dd").nth(1).inner_text() == "0 V"
        page.locator("#play").click()
        page.wait_for_function("document.querySelector('#ctl-phase').value !== '0'")
        page.locator("#play").click()
        assert page.locator("#play").get_attribute("aria-pressed") == "false"
        go("labs/transformer")
        assert page.locator("#readouts dd").all_inner_texts() == ["120 V", "1 A", "120 W"]
        page.locator("#ctl-ac").select_option("0")
        assert page.locator("#readouts dd").all_inner_texts() == ["0 V", "0 A", "0 W"]
        go("labs/wave")
        value("freq", 4)
        assert page.locator("#readouts dd").all_inner_texts() == ["3.00 × 10⁸ m/s", "7.5 cm", "0.25 ns"]

        exams = page.evaluate("EM.exams")
        assert len(exams) == 3
        all_ids = set()
        seen_sections = set()
        for exam in exams:
            qs = exam["questions"]
            assert len(qs) == 12 and sum(q["points"] for q in qs) == 100
            assert sum(q["points"] for q in qs if q["type"] == "written") == 16
            assert sum(q["type"] == "group" for q in qs) == 3
            assert all(len(q["key"]) in (2, 3) for q in qs if q["type"] == "multi")
            assert {q["bloom"] for q in qs} == {"記憶", "理解", "應用", "分析"}
            for q in qs:
                assert q["id"] not in all_ids
                all_ids.add(q["id"])
                seen_sections.add(q["section"])
                if q["key"]:
                    assert len(set(q["key"])) == len(q["key"])
                    assert all(0 <= k < len(q["options"]) for k in q["key"])
            go(f"practice/{exam['chapter']}")
            assert page.locator(".question").count() == 12
            assert page.locator(".group-intro svg").count() == 1
            page.get_by_role("button", name="交卷看詳解").click()
            assert "0 / 84 分" in page.locator("#exam-score").inner_text()
            first_multi = next(q for q in qs if q["type"] == "multi")
            page.locator(f'[name={first_multi["id"]}][value="{first_multi["key"][0]}"]').check()
            page.get_by_role("button", name="交卷看詳解").click()
            assert "0 / 84 分" in page.locator("#exam-score").inner_text()
            for q in qs:
                for k in q["key"] or []:
                    page.locator(f'[name={q["id"]}][value="{k}"]').check()
            page.get_by_role("button", name="交卷看詳解").click()
            assert "84 / 84 分" in page.locator("#exam-score").inner_text()
            page.reload()
            assert page.locator("#exam-form input:checked").count() == sum(len(q["key"] or []) for q in qs)
            page.get_by_role("button", name="清除本卷答案").click()
            assert page.locator("#exam-form input:checked").count() == 0
        assert len(seen_sections) == 12

        routes = ["home", "course", "course/2-4", "labs", "labs/particle", "labs/conductors",
                  "labs/transformer", "practice", "practice/1", "practice/2", "practice/3", "reference"]
        for width in [320, 390, 768, 1024, 1440]:
            page.set_viewport_size({"width": width, "height": 940})
            for route in routes:
                go(route)
                assert page.evaluate("document.documentElement.scrollWidth === innerWidth"), (width, route)
                assert page.locator("main p:visible, .options label span:last-child:visible").evaluate_all(
                    """elements => elements.every(e => {
                        const c = getComputedStyle(e);
                        return e.getBoundingClientRect().width >= 90 &&
                            e.scrollWidth <= Math.ceil(e.getBoundingClientRect().width) &&
                            c.writingMode === 'horizontal-tb' && c.wordBreak !== 'break-all';
                    })"""
                ), (width, route, "prose")
            if out and width in (390, 1440):
                for route in ["home", "labs/particle", "practice/1"]:
                    go(route)
                    page.screenshot(path=out / f"{width}-{route.replace('/', '-')}.png")
        if out:
            for exam in exams:
                n = exam["chapter"]
                go(f"practice/{n}")
                for mode in ["test", "key"]:
                    page.evaluate("(mode) => document.body.dataset.print=mode", mode)
                    page.pdf(path=out / f"print-{n}-{mode}.pdf", prefer_css_page_size=True)
                page.evaluate("delete document.body.dataset.print")
        assert not errors, errors
        browser.close()
    print("Passed: 12 lessons, 12 labs, 36 questions, grading and persistence, 5 responsive widths.")


if __name__ == "__main__":
    args = argparse.ArgumentParser()
    args.add_argument("url", nargs="?", default="http://localhost:8000/")
    args.add_argument("--screenshots", type=Path)
    ns = args.parse_args()
    if ns.screenshots:
        ns.screenshots.mkdir(parents=True, exist_ok=True)
    run(ns.url, ns.screenshots)
