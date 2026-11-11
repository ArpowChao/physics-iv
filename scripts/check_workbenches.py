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
        # 情境實驗與 3D 空間圖同一份清單：6 個情境實驗＋23 個工作臺情境
        assert page.locator(".sim-card").count() == 29
        modes = page.evaluate("EM.workbenches.flatMap(b=>b.modes.map(m=>['labs/'+b.id+'/'+m.id,m.controls]))")
        assert len(modes) == 23
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

        go("labs/induction/enter", guided=True)
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

        go("labs/biot/element")
        expect("theta", "70.9°")
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
        expect("theta", "90°")
        page.get_by_role("button", name="2D 平面").click()
        page.get_by_role("button", name="XY", exact=True).click()
        page.get_by_role("checkbox", name="分析標註").check()
        page.locator("#bench-plot [data-projection=xy] [data-normal=out]").first.wait_for()
        page.get_by_role("checkbox", name="分析標註").uncheck()
        page.get_by_role("button", name="3D 空間").click()
        go("labs/biot/pair")
        page.locator("#bench-relative").select_option("1")
        expect("total", "0 μT")

        go("labs/potential-map/charges")
        page.get_by_role("button", name="等電位線", exact=True).click()
        page.get_by_role("button", name="等量異號中點").click()
        expect("potential", "0 V")
        assert read("field").inner_text() != "0 N/C"
        page.locator("#bench-record").click()
        expect("work", "0 nJ")
        val("x", 4)
        page.wait_for_function("!document.querySelector('[data-reading=work]').textContent.startsWith('0 nJ')")
        # 點電荷模式只留電位地形與等電位線；電力線與剖面圖在「電力線與庫侖力」。
        assert page.get_by_role("button", name="沿軸剖面圖").count() == 0
        assert page.locator("[data-electro-display=lines]").count() == 0
        page.get_by_role("button", name="2D 平面").click()
        page.get_by_role("button", name="YZ", exact=True).click()
        expect("slice", "x = 4 cm")
        page.get_by_role("button", name="XZ", exact=True).click()
        expect("slice", "y = 0 cm")
        assert read("work").inner_text() != "0 nJ"

        go("labs/potential-map/field-lines", guided=True)
        page.locator("[data-case='0']").click()
        page.get_by_role("button", name="2D 平面").click()
        page.get_by_role("button", name="XY", exact=True).click()
        page.locator("#bench-plot svg[data-projection=xy]").wait_for()
        facts = page.locator(".bench-electro-facts")
        page.wait_for_function("document.querySelector('.bench-electro-facts').textContent.includes('23.56')")
        key=page.locator("#bench-plot [data-field-key]")
        # 2D 是切面示意，不標線數；線數與電量成正比只在 3D 計數。
        assert "切面示意" in key.text_content() and "條" not in key.text_content() and "23.56" in key.text_content()
        assert "條" not in facts.inner_text()
        page.get_by_role("button", name="3D 空間").click()
        page.locator("#bench-plot svg[data-projection='3d']").wait_for()
        assert all(text in facts.inner_text() for text in ["10 條","2 條","8 條"])
        assert all(text in key.text_content() for text in ["Q₁ 10 條","相連 2 條","通往無窮遠 8 條","23.56"])
        density = page.get_by_role("combobox", name="線條密度")
        assert density.input_value() == "2"
        for value, counts in [("1", ["Q₁ 5 條", "相連 1 條", "通往無窮遠 4 條"]),
                              ("6", ["Q₁ 30 條", "相連 6 條", "通往無窮遠 24 條"])]:
            density.select_option(value)
            page.wait_for_function(
                """(counts)=>counts.every(text=>document.querySelector('[data-field-key]').textContent.includes(text))""",
                arg=counts
            )
            assert "23.56" in key.text_content()
        page.get_by_role("button", name="2D 平面").click()
        page.locator("#bench-plot svg[data-projection=xy]").wait_for()
        assert page.locator('td[data-measure="joined-share"][data-evidence="0"]').inner_text() == "20%"
        assert page.locator('td[data-measure="joined-share"][data-evidence="1"]').inner_text() == "100%"
        density.select_option("2")
        page.get_by_role("button", name="遠場", exact=True).click()
        page.get_by_role("button",name="只看相連線").click()
        assert page.get_by_role("button", name="近場", exact=True).get_attribute("aria-pressed")=="true"
        page.wait_for_function("document.querySelectorAll('#bench-plot polyline[stroke=\"#b05219\"][stroke-width=\"2.45\"]').length===2 && !document.querySelector('#bench-plot polyline[stroke=\"#377b76\"]')")
        page.get_by_role("button",name="顯示全部線").click()
        page.locator("#bench-plot [data-landmark=electric-null]").wait_for()
        page.get_by_role("button", name="沿軸剖面圖").click()
        assert page.get_by_role("button", name="遠場", exact=True).get_attribute("aria-pressed")=="true"
        page.locator("#bench-plot[data-dimension=profile] svg:not([data-projection])").wait_for()
        assert page.locator("#bench-plot [data-axis-zero]").count() == 2
        page.get_by_role("button", name="電力線", exact=True).click()
        assert page.get_by_role("button", name="近場", exact=True).get_attribute("aria-pressed")=="true"
        page.get_by_role("button", name="3D 空間").click()
        page.locator("#bench-plot svg[data-projection='3d']").wait_for()
        plot = page.locator("#bench-plot svg")
        old = plot.inner_html()
        page.locator(".bench-depth select").select_option("front")
        page.wait_for_function("(old)=>document.querySelector('#bench-plot svg').innerHTML!==old",arg=old)
        assert "10 條" in facts.inner_text()
        page.get_by_role("button",name="只看正視切面").click()
        assert page.locator(".bench-depth select").input_value()=="section"
        assert page.get_by_role("button", name="3D 電位地形", exact=True).count() == 0

        go("labs/potential-map/sphere", guided=True)
        assert "12 條" in page.locator(".bench-electro-facts").inner_text()
        page.get_by_role("combobox", name="線條密度").select_option("4")
        page.wait_for_function("document.querySelector('.bench-electro-facts').textContent.includes('24 條')")
        go("labs/potential-map/cavity", guided=True)
        page.locator("[data-case='1']").click()
        page.wait_for_function("""document.querySelector('td[data-measure=field][data-evidence="1"]').textContent==='0 N/C'""")
        assert "8 條" in page.locator(".bench-electro-facts").inner_text()
        assert "-40.58" in page.locator(".bench-electro-facts").inner_text()

        go("labs/potential-map/plates")
        val("x", -9)
        expect("potential", "14 V")
        expect("field", "表面兩側值不同")
        val("x", 0)
        expect("vector", "(77.8, 0, 0) N/C")
        val("x", 9)
        expect("potential", "0 V")
        expect("field", "表面兩側值不同")

        go("labs/potential-map/field-lines")
        page.get_by_role("button", name="2D 平面").click()
        page.get_by_role("button", name="XY", exact=True).click()
        page.locator("#bench-plot [data-projection=xy]").wait_for()
        assert page.locator("#bench-plot circle:not([data-probe])").count() == 3
        assert page.locator("#bench-plot .bench-plot-label").count() == 0
        page.locator("#bench-plot [data-probe]").wait_for(state="attached")
        box = page.locator("#bench-plot [data-probe]").bounding_box()
        x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x + 40, y + 15, steps=5)
        page.mouse.up()
        page.wait_for_function("Number(document.querySelector('#bench-x').value)>0")
        assert page.locator("#bench-z").input_value() == "0"
        page.locator("#bench-vectors").select_option("1")
        page.locator("#bench-plot .bench-plot-label").filter(has_text="E").wait_for()
        page.locator("#bench-vectors").select_option("2")
        page.locator("#bench-plot .bench-plot-label").filter(has_text="F").wait_for()
        assert page.locator("#bench-plot .bench-plot-label").filter(has_text="E").count() == 0
        field = read("vector").inner_text()
        before = read("force").inner_text()
        page.locator("#bench-test").select_option("-1")
        page.wait_for_function("(old)=>document.querySelector('[data-reading=force]').textContent!==old", arg=before)
        assert read("vector").inner_text() == field
        val("q",12)
        val("q2",-11)
        val("spacing",28)
        page.locator("#bench-plot [data-landmark=electric-null]").wait_for(state="detached")
        page.get_by_role("button",name="遠場",exact=True).click()
        page.locator("#bench-plot [data-landmark=electric-null]").wait_for()
        page.get_by_role("button",name="近場",exact=True).click()

        go("labs/particle-apps/linear")
        expect("frequency", "2 MHz")
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
        curtain = page.locator("#bench-plot svg[data-theme=space] polygon[fill='url(#art-curtain)']").first
        page.get_by_role("button", name="小夾角：到達參考面").click()
        expect("fate", "可達 110 km 參考面")
        expect("altitude", "110 km")
        assert curtain.count() == 0
        page.get_by_role("button", name="電子群沉降").click()
        curtain.wait_for()
        val("phase", 99)
        curtain.wait_for(state="detached")
        page.get_by_role("button", name="大夾角：磁鏡折返").click()
        expect("fate", "已在磁鏡點折返")
        assert page.locator("#bench-plot polygon[fill='url(#art-curtain)']").count() == 0

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
            if width == 390:
                go("labs/biot/element")
                page.get_by_role("combobox", name="實驗情境").select_option("loop")
                page.wait_for_function("document.querySelector('main').dataset.route==='labs/biot/loop'")
            for route in ["labs", "labs/biot/element", "labs/potential-map/charges", "labs/potential-map/field-lines", "labs/potential-map/cavity", "labs/magnetic-force/particle",
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
    print("Verified guided comparisons and free exploration for all 23 scenes, including electrostatic line counts, depth, nulls, terrain, and mobile reflow.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("url")
    parser.add_argument("--screenshots", type=Path)
    args = parser.parse_args()
    if args.screenshots:
        args.screenshots.mkdir(parents=True, exist_ok=True)
    run(args.url, args.screenshots)
