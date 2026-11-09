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

        def go(route):
            page.goto(f"{base.rstrip('/')}/#{route}")
            page.wait_for_function("(r)=>document.querySelector('main').dataset.route===r", arg=route)

        def read(key):
            return page.locator(f'[data-reading="{key}"]')

        def val(k, v):
            page.locator(f"#bench-{k}").fill(str(v))

        def expect(key, text):
            page.wait_for_function(
                "([k,s])=>document.querySelector('[data-reading='+k+']')?.textContent.includes(s)", arg=[key, text]
            )

        go("labs")
        assert page.locator(".bench-index .lab-card").count() == 6
        modes = page.evaluate("EM.workbenches.flatMap(b=>b.modes.map(m=>['labs/'+b.id+'/'+m.id,m.controls]))")
        assert len(modes) == 24
        for route, controls in modes:
            go(route)
            assert page.locator(".bench-modes [aria-current]").count() == 1
            assert page.locator("#bench-plot svg").count() == 1
            assert page.locator(".bench-readouts dd").count() >= 3
            assert page.locator(".bench-inputs [data-param]").count() == len(controls)
            assert not page.locator(".bench-shell").evaluate("(e)=>/NaN|Infinity/.test(e.innerHTML)")
            readings = page.locator("#bench-readouts").inner_text()
            page.get_by_role("button", name="2D 平面").click()
            for plane in ["XY", "XZ", "YZ"]:
                page.get_by_role("button", name=plane, exact=True).click()
                page.locator(f"#bench-plot svg[data-projection={plane.lower()}]").wait_for()
                assert not page.locator(".bench-shell").evaluate("(e)=>/NaN|Infinity/.test(e.innerHTML)")
            assert page.locator("#bench-readouts").inner_text() == readings or route.startswith("labs/potential-map/")
            page.get_by_role("button", name="3D 空間").click()
            page.locator("#bench-plot svg[data-projection='3d']").wait_for()

        go("labs/biot/element")
        plot = page.locator("#bench-plot svg")
        before = plot.inner_html()
        box = plot.bounding_box()
        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        page.mouse.down()
        page.mouse.move(box["x"] + box["width"] / 2 + 76, box["y"] + box["height"] / 2 + 42, steps=5)
        page.mouse.up()
        page.wait_for_function("(old)=>document.querySelector('#bench-plot svg').innerHTML!==old", arg=before)
        reading = read("vector").inner_text()
        page.get_by_role("button", name="俯視 XY").click()
        page.wait_for_function("document.querySelector('[data-view=pitch]').value==='90'")
        assert read("vector").inner_text() == reading
        page.get_by_role("button", name="平行", exact=True).click()
        expect("total", "0 μT")
        page.get_by_role("button", name="垂直", exact=True).click()
        expect("total", "0.313 μT")
        go("labs/biot/pair")
        page.locator("#bench-relative").select_option("1")
        expect("total", "0 μT")

        go("labs/potential-map/charges")
        page.get_by_role("button", name="等量異號中點").click()
        expect("potential", "0 V")
        assert read("field").inner_text() != "0 N/C"
        page.locator("#bench-record").click()
        expect("work", "0 nJ")
        val("x", 4)
        page.wait_for_function("!document.querySelector('[data-reading=work]').textContent.startsWith('0 nJ')")
        assert page.locator("#bench-graph svg").count() == 1
        page.get_by_role("button", name="2D 平面").click()
        page.get_by_role("button", name="YZ", exact=True).click()
        expect("slice", "x = 4 cm")
        page.get_by_role("button", name="XZ", exact=True).click()
        expect("slice", "y = 0 cm")
        assert read("work").inner_text() != "0 nJ"

        go("labs/potential-map/field-lines")
        field = read("vector").inner_text()
        before = read("force").inner_text()
        page.locator("#bench-test").select_option("-1")
        page.wait_for_function("(old)=>document.querySelector('[data-reading=force]').textContent!==old", arg=before)
        assert read("vector").inner_text() == field

        go("labs/particle-apps/linear")
        val("phase", 0)
        expect("energy", "80 eV")
        val("phase", 100)
        expect("energy", "1,680 eV")
        go("labs/particle-apps/cyclotron")
        val("phase", 0)
        expect("crossing", "1")
        val("phase", 100)
        expect("crossing", "8")
        expect("energy", "3,280 eV")
        go("labs/particle-apps/aurora")
        page.get_by_role("button", name="小夾角：進入大氣").click()
        expect("fate", "可進入高層大氣")
        expect("altitude", "110 km")
        page.get_by_role("button", name="大夾角：磁鏡折返").click()
        expect("fate", "已在磁鏡點折返")

        go("labs/magnetic-force/parallel")
        expect("relation", "相吸")
        val("i2", -4)
        expect("relation", "相斥")
        go("labs/magnetic-force/particle")
        page.get_by_role("button", name="平行：直線").click()
        expect("radius", "直線")
        expect("force", "0 μN")
        page.get_by_role("button", name="垂直：圓周").click()
        expect("period", "0 cm")
        play = page.locator("#bench-play")
        phase = page.locator("#bench-phase").input_value()
        play.click()
        page.wait_for_function("(v)=>document.querySelector('#bench-phase').value!==v", arg=phase)
        play.click()
        assert play.get_attribute("aria-pressed") == "false"

        go("labs/induction/slide")
        emf = read("emf").inner_text()
        assert read("power").inner_text() == read("work").inner_text()
        page.locator("#bench-closed").select_option("0")
        expect("current", "0 A")
        assert read("emf").inner_text() == emf
        expect("power", "0 μW")
        go("labs/induction/enter")
        page.get_by_role("button", name="全在場內").click()
        expect("emf", "0 V")
        assert read("flux").inner_text() != "0 Wb"
        graph = page.locator("#bench-graph")
        size = graph.bounding_box()
        graph.click(position={"x": size["width"] * .78, "y": size["height"] * .4})
        page.wait_for_function("document.querySelector('#bench-phase').value!=='50'")
        assert not errors, errors

        for width in [320, 390, 768, 1024, 1440]:
            page.set_viewport_size({"width": width, "height": 960})
            for route in ["labs", "labs/biot/element", "labs/potential-map/charges", "labs/potential-map/field-lines", "labs/magnetic-force/particle",
                          "labs/particle-apps/cyclotron", "labs/particle-apps/aurora", "labs/induction/transformer", "labs/em-wave/plane-wave"]:
                go(route)
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
    print("Verified 24 workbench scenes in 3D and all three 2D planes, with shared readings, controls, and mobile reflow.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("--screenshots", type=Path)
    args = parser.parse_args()
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    run(args.url, args.screenshots)
