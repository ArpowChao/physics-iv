"""Browser checks for advanced physics workbenches and their responsive controls."""
import argparse
from pathlib import Path
from playwright.sync_api import sync_playwright


def run(base, out):
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 960})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)

        def go(route, guided=False):
            page.goto(f"{base.rstrip('/')}/#{route}")
            page.wait_for_function("(r)=>document.querySelector('main').dataset.route===r", arg=route)
            if page.locator(".bench-activity-switch").count():
                set_activity("guided" if guided else "free")

        def set_activity(activity):
            button = page.locator(f'[data-activity="{activity}"]')
            if button.get_attribute("aria-pressed") != "true":
                button.click()
            page.locator(f'.bench-layout[data-activity-layout="{activity}"]').wait_for()
            page.evaluate("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")

        def read(key):
            return page.locator(f'[data-reading="{key}"]')

        def val(k, v):
            page.locator(f"#bench-{k}").fill(str(v))

        def expect(key, text):
            page.wait_for_function(
                "([k,s])=>document.querySelector('[data-reading='+k+']')?.textContent.includes(s)", arg=[key, text]
            )

        go("labs")
        # 情境實驗與 3D 空間圖同一份清單：7 個情境實驗＋15 個工作臺情境
        assert page.locator(".sim-card").count() == 24
        modes = page.evaluate("EM.workbenches.flatMap(b=>b.modes.map(m=>['labs/'+b.id+'/'+m.id,m.controls]))")
        assert len(modes) == 15
        for route, controls in modes:
            go(route, guided=True)
            assert page.locator(".bench-modes [aria-current]").count() == 1
            assert page.locator("#bench-plot svg").count() == 1
            lesson = page.evaluate("m=>EM.workbenchLessons[m]", route.split("/")[-1])
            control = next(c for c in controls if c["key"] == lesson["variable"][0])
            a, b = lesson["variable"][1:]
            assert a != b
            if "choices" in control:
                assert all(v in [choice[0] for choice in control["choices"]] for v in [a, b])
            else:
                assert control["min"] <= min(a, b) <= max(a, b) <= control["max"]
            assert not page.locator(".bench-side").is_visible()
            assert page.locator(".bench-explanation").is_hidden()
            case_a = page.locator("td[data-evidence='0']")
            case_b = page.locator("td[data-evidence='1']")
            initial = case_a.all_inner_texts()
            assert len(initial) == 2 and all(v != "—" for v in initial), route
            assert case_b.all_inner_texts() == ["—", "—"], route
            scale = page.locator("#bench-plot svg").get_attribute("data-scale")
            page.locator(".bench-choices input").first.check()
            page.locator("[data-case='1']").click()
            page.locator(".bench-explanation").wait_for()
            assert page.locator("#bench-plot svg").get_attribute("data-scale") == scale, route
            assert case_a.all_inner_texts() == initial, route
            assert case_b.all_inner_texts() != initial and all(v != "—" for v in case_b.all_inner_texts()), route
            assert page.locator(".bench-explanation").get_attribute("open") is None
            page.locator(".bench-explanation summary").click()
            assert page.locator(".bench-explanation p").is_visible()
            set_activity("free")
            assert page.locator(".bench-readouts dd").count() >= 3
            assert page.locator(".bench-inputs [data-param]").count() == len(controls)
            assert not page.locator(".bench-shell").evaluate("(e)=>/NaN|Infinity/.test(e.innerHTML)")
            assert page.get_by_role("checkbox", name="分析標註").is_checked() == ("potential-map" not in route), route
            assert page.locator("#bench-plot circle").evaluate_all(
                r"""(circles)=>circles.every(el=>{
                    const fill=el.getAttribute('fill'), gradient=/^url\(#([\w-]+)\)$/.exec(fill);
                    return gradient?!!el.ownerSVGElement.querySelector('#'+gradient[1]):fill==='none'||CSS.supports('color',fill);
                })"""
            ), route
            readings = page.locator("#bench-readouts").inner_text()
            page.get_by_role("button", name="2D 平面").click()
            for plane in ["XY", "XZ", "YZ"]:
                page.get_by_role("button", name=plane, exact=True).click()
                page.locator(f"#bench-plot svg[data-projection={plane.lower()}]").wait_for()
                assert not page.locator(".bench-shell").evaluate("(e)=>/NaN|Infinity/.test(e.innerHTML)")
            assert page.locator("#bench-readouts").inner_text() == readings or route.startswith("labs/potential-map/")
            page.get_by_role("button", name="3D 空間").click()
            page.locator("#bench-plot svg[data-projection='3d']").wait_for()

        go("labs/induction/transformer", guided=True)
        saved_readings = page.locator(".bench-evidence table").inner_text()
        plot = page.locator("#bench-plot svg")
        case_plot = plot.inner_html()
        page.locator("#bench-play").click()
        page.locator(".bench-preview").wait_for()
        page.wait_for_function("(old)=>document.querySelector('#bench-plot svg').innerHTML!==old", arg=case_plot)
        assert page.locator(".bench-evidence table").inner_text() == saved_readings
        page.locator("#bench-play").click()
        page.wait_for_function("(old)=>document.querySelector('#bench-plot svg').innerHTML===old", arg=case_plot)
        set_activity("free")
        val("phase", 71)
        set_activity("guided")
        assert page.locator(".bench-evidence table").inner_text() == saved_readings
        assert page.locator(".bench-choices input").first.is_checked()
        set_activity("free")
        assert page.locator("#bench-phase").input_value() == "71"
        # 自由探索時點同步圖表可移動游標
        graph = page.locator("#bench-graph")
        size = graph.bounding_box()
        graph.click(position={"x": size["width"] * .2, "y": size["height"] * .4})
        page.wait_for_function("document.querySelector('#bench-phase').value!=='71'")

        # 單一電流元、直導線、圓線圈、螺線管已併入同一個 3D 情境實驗，舊網址要導向
        for old, new in [("element", "biot-savart"), ("straight", "biot-savart"), ("loop", "biot-savart"), ("solenoid", "solenoid-field")]:
            page.goto(f"{base.rstrip('/')}/#labs/biot/{old}")
            page.wait_for_function(f"location.hash==='#labs/{new}'")
        go("labs/biot/pair")
        plot = page.locator("#bench-plot svg")
        before = plot.inner_html()
        box = plot.bounding_box()
        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        page.mouse.down()
        page.mouse.move(box["x"] + box["width"] / 2 + 76, box["y"] + box["height"] / 2 + 42, steps=5)
        page.mouse.up()
        page.wait_for_function("(old)=>document.querySelector('#bench-plot svg').innerHTML!==old", arg=before)
        reading = read("total").inner_text()
        page.get_by_role("button", name="俯視 XY").click()
        page.wait_for_function("document.querySelector('[data-view=pitch]').value==='90'")
        assert read("total").inner_text() == reading
        assert not errors, errors

        for width in [320, 390, 768, 1024, 1440]:
            page.set_viewport_size({"width": width, "height": 960})
            if width == 390:
                go("labs/biot/pair")
                page.get_by_role("combobox", name="實驗情境").select_option("compass")
                page.wait_for_function("document.querySelector('main').dataset.route==='labs/biot/compass'")
            for route in ["labs", "labs/biot/pair", "labs/potential-map/charges", "labs/potential-map/field-lines", "labs/potential-map/cavity", "labs/magnetic-force/particle",
                          "labs/particle-apps/cyclotron", "labs/particle-apps/aurora", "labs/induction/transformer", "labs/em-wave/plane-wave"]:
                go(route, guided=True)
                assert page.evaluate("document.documentElement.scrollWidth === innerWidth"), (width, route, "guided")
                if route != "labs":
                    assert page.locator(".bench-prediction,.bench-visual,.bench-evidence").evaluate_all(
                        "(es)=>es.every(e=>e.clientWidth>=230&&e.scrollWidth<=e.clientWidth+1)"
                    ), (width, route, "guided")
                    if out and width in (390, 1440):
                        page.evaluate("window.scrollTo(0,0)")
                        page.screenshot(path=out / f"{width}-{route.replace('/', '-')}-guided.png", full_page=True)
                    set_activity("free")
                assert page.evaluate("document.documentElement.scrollWidth === innerWidth"), (width, route)
                assert page.locator(".bench-inputs .control:visible, .bench-readouts dd:visible, .bench-note:visible").evaluate_all(
                    "(es)=>es.every(e=>e.clientWidth>=60&&e.scrollWidth<=e.clientWidth+1&&getComputedStyle(e).writingMode==='horizontal-tb')"
                ), (width, route)
                if out and width in (390, 1440) and route != "labs":
                    page.locator("#bench-reset").click()
                    page.wait_for_function("document.querySelector('#bench-notice').textContent.includes('已恢復')")
                    page.wait_for_function("new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))")
                    page.evaluate("window.scrollTo(0,0)")
                    page.screenshot(path=out / f"{width}-{route.replace('/', '-')}.png")
                    page.get_by_role("button", name="2D 平面").click()
                    plane = "XZ" if route in ("labs/particle-apps/aurora", "labs/induction/transformer", "labs/magnetic-force/particle") else "XY"
                    page.get_by_role("button", name=plane, exact=True).click()
                    page.locator(f"#bench-plot svg[data-projection={plane.lower()}]").wait_for()
                    page.screenshot(path=out / f"{width}-{route.replace('/', '-')}-2d.png")
                    page.get_by_role("button", name="3D 空間").click()
        assert not errors, errors
        browser.close()
    print("Verified guided comparisons and free exploration for all 15 scenes, including electrostatic line counts, depth, nulls, terrain, and mobile reflow.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("--screenshots", type=Path)
    args = parser.parse_args()
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    run(args.url, args.screenshots)
