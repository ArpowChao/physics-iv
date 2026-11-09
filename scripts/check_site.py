"""Check learning navigation, concept feedback, simulation outputs, exams, and responsive layout."""
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
            wait_route(route)

        def wait_route(route):
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
        assert page.locator("#sidebar .nav-item-node").count() == 12
        assert page.locator("#sidebar .chapter-nav[open]").count() == 0
        assert page.locator(".study-flow > div").count() == 3
        page.locator(".chapter-card a").first.click()
        wait_route("course/chapter-1")
        assert page.locator(".node-list a").count() == 3
        assert page.locator("#sidebar .chapter-nav[open]").count() == 1
        page.locator("#toolbar-back").click()
        wait_route("home")
        sections = page.evaluate("EM.sections.map(({id, lab, topics}) => [id, lab, topics.length, EM.conceptPractice[id]])")
        assert len(sections) == len({i[1] for i in sections}) == 12
        assert sum(s[2] for s in sections) == 30
        assert sum(len(group) for _, _, _, groups in sections for group in groups) == 60
        unique_stems = set()
        for sid, lid, topic_count, groups in sections:
            go(f"course/{sid}")
            assert page.locator(".observe-card a").get_attribute("href") == f"#labs/{lid}"
            assert page.locator("#sidebar .nav-item-node[aria-current=page]").get_attribute("href") == f"#course/{sid}"
            assert page.locator(".concept-card").count() == len(groups) == topic_count
            for i, group in enumerate(groups):
                assert len(group) == 2
                details = page.locator(f'.topic-practice[data-topic="{i}"]')
                details.locator("summary").click()
                for j, q in enumerate(group):
                    assert q["stem"] not in unique_stems and q["explanation"]
                    unique_stems.add(q["stem"])
                    assert q["level"] in {"記憶", "理解", "應用", "分析"}
                    assert len(set(q["choices"])) == 4 and 0 <= q["key"] < 4
                    rendered = details.locator(f'[data-question="{j}"]')
                    assert rendered.locator("svg").count() == int(bool(q["figure"]))
                    rendered.locator(f'[data-choice="{q["key"]}"]').click()
                    assert "答對了" in rendered.locator(".check-feedback").inner_text()
                assert "2 / 2" in details.locator("[data-topic-score]").inner_text()
                details.locator("summary").click()
            go(f"labs/{lid}")
            assert page.locator("#lab-plot svg").count() == 1
            assert page.locator("#readouts dd").count() >= 2
            assert not page.locator(".lab-layout").evaluate("(el) => /NaN|Infinity/.test(el.innerHTML)")

        go("course/1-1")
        page.locator("#mark").click()
        page.reload()
        assert page.locator("#mark").get_attribute("aria-pressed") == "true"
        page.locator("#mark").click()
        go("concepts/1")
        assert page.locator(".concept-chapter").count() == 1
        assert "2 / 2" in page.locator(".node-list a").first.inner_text()
        page.locator(".node-list a").first.click()
        wait_route("course/1-1/1")
        assert page.locator(".topic-practice[open]").count() == 1
        assert page.locator("#topic-1-1-1").evaluate("el => el === document.activeElement")
        choice = page.locator(".topic-practice[open] [data-question='0'] [data-choice='0']")
        choice.click()
        assert "答案是 B" in page.locator(".topic-practice[open] .check-feedback").first.inner_text()
        assert "2 / 2" in page.locator(".topic-practice[open] [data-topic-score]").inner_text()

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

        routes = ["home", "course", "course/chapter-2", "course/2-4", "course/1-2/1", "course/3-3/2",
                  "labs", "labs/particle", "labs/conductors", "labs/transformer",
                  "concepts", "concepts/3", "practice", "practice/1", "practice/2", "practice/3", "reference"]
        for width in [320, 390, 768, 1024, 1440]:
            page.set_viewport_size({"width": width, "height": 940})
            for route in routes:
                go(route)
                assert page.evaluate("document.documentElement.scrollWidth === innerWidth"), (width, route)
                assert page.locator("main p:not(.eyebrow):visible, .options label span:last-child:visible, .check-options button span:last-child:visible").evaluate_all(
                    """elements => elements.every(e => {
                        const c = getComputedStyle(e);
                        return e.getBoundingClientRect().width >= 90 &&
                            e.scrollWidth <= Math.ceil(e.getBoundingClientRect().width) &&
                            c.writingMode === 'horizontal-tb' && c.wordBreak !== 'break-all';
                    })"""
                ), (width, route, "prose")
            if width <= 900:
                go("home")
                assert not page.locator("#side-links").is_visible()
                page.get_by_role("button", name="開啟導覽選單").click()
                assert page.locator("#side-links").is_visible()
                page.locator("#sidebar [data-route=concepts]").click()
                wait_route("concepts")
                assert not page.locator("#side-links").is_visible()
            if out and width in (390, 1440):
                for route in ["home", "course/1-1", "course/1-2/1", "course/3-3/2", "concepts/3", "labs/particle", "practice/1"]:
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
    print("Passed: 12 lessons, 30 concepts, 60 concept questions, 12 labs, 36 exam questions, and 5 responsive widths.")


if __name__ == "__main__":
    args = argparse.ArgumentParser()
    args.add_argument("url", nargs="?", default="http://localhost:8000/")
    args.add_argument("--screenshots", type=Path)
    ns = args.parse_args()
    if ns.screenshots:
        ns.screenshots.mkdir(parents=True, exist_ok=True)
    run(ns.url, ns.screenshots)
