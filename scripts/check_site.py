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
            assert page.locator('.observe-card a[href^="#labs/"]').count() >= 1
            assert page.locator(f'.observe-card a[href="#labs/{lid}"]').count() == 0
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
            # 舊的基礎實驗網址導向新的情境實驗或工作臺
            page.goto(f"{base.rstrip('/')}/#labs/{lid}")
            page.wait_for_function("(old) => location.hash !== '#labs/' + old && document.querySelector('main').dataset.route.startsWith('labs/')", arg=lid, timeout=5000)

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

        def ro(name):
            return page.locator(f'[data-ro="{name}"]').inner_text()

        def slide(name, val):
            page.locator(f"#kc-{name}").fill(str(val))

        go("labs/coulomb-law")
        page.wait_for_function("document.querySelector('[data-ro=b]').textContent.includes('N')")
        api = "document.querySelector('#scene-root').sceneApi"
        page.evaluate(f"{api}.place(0, 10, 10); {api}.place(1, 20, 10)")
        assert ro("a") == "10.0 cm" and ro("b") == "3.6 N" and ro("c") == "異號互吸", (ro("a"), ro("b"))
        page.evaluate(f"{api}.place(1, 30, 10)")
        assert ro("b") == "0.899 N"
        slide("q2", 2)
        assert ro("c") == "同號互斥" and ro("d") == "180°"
        page.get_by_role("tab", name="三個電荷：力的合成").click()
        assert "合力" in page.locator('[data-rl="c"]').inner_text()

        go("labs/efield")
        page.get_by_role("tab", name="等量異號").click()
        page.evaluate("document.querySelector('#scene-root').sceneApi.setProbe(0, -4)")
        assert ro("v") == "0 V" and ro("e") != "0 N/C" and ro("dir") == "0°", (ro("v"), ro("e"), ro("dir"))
        page.get_by_role("tab", name="等量同號").click()
        page.evaluate("document.querySelector('#scene-root').sceneApi.setProbe(0, 0)")
        assert ro("e") == "0 N/C" and ro("v") != "0 V"
        page.locator("#kc-profile").select_option("V")
        assert page.locator("[data-kit-chart-wrap]").is_visible()

        # 全螢幕：畫布撐滿、按鈕可切回
        page.locator(".full-btn").click()
        page.wait_for_function("document.querySelector('.scene-root.is-full canvas').getBoundingClientRect().height > innerHeight * 0.5")
        page.locator(".full-btn").click()
        page.wait_for_function("!document.querySelector('.is-full')")

        go("labs/deflect")
        page.wait_for_function("document.querySelector('[data-ro=y]').textContent.includes('cm')")
        y_electron = ro("y")
        assert ro("y") == "0.469 cm（向上）", ro("y")
        page.locator("#kc-kind").select_option("proton")
        assert ro("y") == "0.469 cm（向下）" and ro("v0") != "—"
        slide("V", 400)
        assert "撞到" in ro("y")

        go("labs/b-particle")
        assert ro("r") == "10.4 cm" and ro("turn") == "逆時針", (ro("r"), ro("turn"))
        slide("v", 20)
        assert ro("r") == "20.9 cm"
        page.locator("#kc-dir").select_option("out")
        assert ro("turn") == "順時針"

        go("labs/dc-motor")
        page.evaluate("document.querySelector('#scene-root').sceneApi.set(0)")
        page.wait_for_function("document.querySelector('[data-ro=tau]').textContent.startsWith('0.018')")
        assert ro("F") == "0.45 N"

        # 必歐－沙伐 3D：|ΔB| = μ0/4π · I Δℓ sinθ / r²（Δℓ = 0.8 m）
        go("labs/biot-savart")
        page.locator(".bs-canvas canvas").wait_for(state="attached")
        bs = lambda: page.locator('[data-r="b"]').inner_text()
        assert bs() == "1.26 × 10⁻⁸ T", bs()
        page.evaluate("document.querySelector('#scene-root').sceneApi.set({r:1.5})")
        assert bs() == "5.03 × 10⁻⁸ T", bs()   # r 減半 → 4 倍
        page.evaluate("document.querySelector('#scene-root').sceneApi.set({t:90})")
        assert bs() == "7.11 × 10⁻⁸ T", bs()
        st = page.evaluate("(()=>{const s=document.querySelector('#scene-root').sceneApi.state();return s})()")
        # ΔB 方向 = t̂ × r̂，與 r、電流元方向都垂直（彎曲導線上任一段皆然）
        for shape, s in [("curve", 50), ("curve", 20), ("loop", 30), ("straight", 70)]:
            st = page.evaluate(f"(()=>{{const a=document.querySelector('#scene-root').sceneApi;a.set({{shape:'{shape}'}});a.set({{s:{s}}});return a.state()}})()")
            dot = lambda u, v: sum(a * b for a, b in zip(u, v))
            assert abs(dot(st["dir"], st["rv"])) < 1e-9 and abs(dot(st["dir"], st["t"])) < 1e-9, st
            cr = [st["t"][1]*st["rv"][2]-st["t"][2]*st["rv"][1], st["t"][2]*st["rv"][0]-st["t"][0]*st["rv"][2], st["t"][0]*st["rv"][1]-st["t"][1]*st["rv"][0]]
            assert dot(cr, st["dir"]) > 0
            sin = (sum(c * c for c in cr) ** .5) / st["r"]
            assert abs(st["B"] - 1e-7 * 2 * .8 * sin / st["r"] ** 2) < 1e-15, st
        # 換電流元時 P 固定不動
        a = page.evaluate("(()=>{const a=document.querySelector('#scene-root').sceneApi;a.set({shape:'curve'});return a.state().P})()")
        b = page.evaluate("(()=>{const a=document.querySelector('#scene-root').sceneApi;a.set({s:80});return a.state().P})()")
        assert a == b
        page.get_by_role("button", name="只顯示電流元").click()
        assert page.get_by_role("button", name="只顯示電流元").get_attribute("aria-pressed") == "true"
        page.locator(".scene-fullbar button").click()
        page.wait_for_function("document.querySelector('#scene-root').classList.contains('is-full')")
        h = page.evaluate("document.querySelector('.bs-wrap').getBoundingClientRect().height")
        assert h > 700, h
        page.locator(".scene-fullbar button").click()
        page.wait_for_function("!document.querySelector('#scene-root').classList.contains('is-full')")

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
                  "labs", "labs/coulomb-law", "labs/efield", "labs/deflect", "labs/b-particle", "labs/dc-motor", "labs/magnet-coil", "labs/biot-savart",
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
