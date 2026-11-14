#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
generate_figures.py — تولید خودکار Composite Figures (نسخهٔ تیره)

تغییرات:
    ✓ تم داشبورد حفظ می‌شود (تیره، همان‌طور که هست)
    ✓ پس‌زمینهٔ canvas: #12161F (هم‌رنگ --bg داشبورد)
    ✓ حاشیه: #2D3446 (هم‌رنگ --border)
    ✓ برچسب‌ها: #E8ECF1 (هم‌رنگ --text)
    ✓ برچسب‌های فارسی: الف، ب، ج، د
    ✓ Figure A: Forest Plot + R² (بدون دیاگرام مسیر)
"""

import argparse
import asyncio
import base64
import io
import os
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("ERROR: pip install pillow")
    sys.exit(1)

try:
    from playwright.async_api import async_playwright
except ImportError:
    print("ERROR: pip install playwright")
    sys.exit(1)

try:
    import arabic_reshaper
    from bidi.algorithm import get_display
    HAS_RESHAPER = True
except ImportError:
    HAS_RESHAPER = False


# ============================================================
# تنظیمات بصری — هماهنگ با تم دارک داشبورد
# ============================================================
DPI = 300
FIG_WIDTH_MM = 170
FIG_WIDTH_PX = int(FIG_WIDTH_MM / 25.4 * DPI)   # ≈ 2008 px
MARGIN = 24
SUBLABEL_SIZE = 34

# رنگ‌ها از CSS داشبورد
CANVAS_BG    = (18, 22, 31)       # #12161F = --bg
BORDER_COLOR = (45, 52, 70)       # #2D3446 = --border
LABEL_COLOR  = (232, 236, 241)    # #E8ECF1 = --text
EMPTY_FILL   = (30, 36, 51)       # #1E2433 = --card
BORDER_WIDTH = 2
CELL_PADDING = 10


# ============================================================
# تعریف ۳ Figure
# ============================================================
FIGURES = {
    "Figure-A-PLS-SEM": {
        "layout": [["a"], ["b"]],
        "caption_fa": "شکل ۱. خلاصهٔ لایهٔ PLS-SEM. (الف) نمودار جنگلی با فاصلهٔ اطمینان ۹۵٪ (۵,۰۰۰ زیرنمونه بوت‌استرپ)؛ ۹ مسیر از ۱۱ خط صفر را قطع نمی‌کنند. (ب) R² سه سازهٔ درون‌زا؛ SUS با R²=۰.۴۸۹ بالاترین تبیین واریانس را دارد.",
        "caption_en": "Figure 1. PLS-SEM layer summary. (a) Forest plot with 95% CI (5,000 bootstrap subsamples); 9 of 11 paths exclude zero. (b) R² of three endogenous constructs; SUS has the highest explained variance (R²=0.489).",
        "subplots": [
            {"id": "chart-l2-forest", "section": "l2-forest",  "label": "a", "display": "الف"},
            {"id": "chart-l1-r2",     "section": "l1-quality", "label": "b", "display": "ب"},
        ],
    },
    "Figure-B-Heterogeneity": {
        "layout": [["a", "b"], ["c", "d"]],
        "caption_fa": "شکل ۲. ناهمگونی اثر تحول دیجیتال. (الف) CATE بر اساس چارک‌های HG؛ از ۰.۳۳۳ (HG-Q1، دورافتاده) تا ۰.۵۳۳ (HG-Q4، نزدیک شهر) — نسبت ۱.۶۰×. (ب) کیفیت مدل BLP؛ R²=۰.۸۰۹ و کالیبراسیون p=۰.۰۳۱ تأیید می‌کند ناهمگونی واقعی است. (ج) اثر خالص HG (PDP). (د) تعامل سه‌بعدی HG×PR×CATE.",
        "caption_en": "Figure 2. Treatment effect heterogeneity. (a) CATE across HG quartiles; from 0.333 (HG-Q1, remote) to 0.533 (HG-Q4, near-city) — ratio 1.60×. (b) BLP quality (R²=0.809, calibration p=0.031). (c) Net HG effect (PDP). (d) 3D HG×PR×CATE interaction.",
        "subplots": [
            {"id": "cm-3",  "section": "causal-ml", "label": "a", "display": "الف"},
            {"id": "cm-10", "section": "causal-ml", "label": "b", "display": "ب"},
            {"id": "cm-5",  "section": "causal-ml", "label": "c", "display": "ج"},
            {"id": "cm-7",  "section": "causal-ml", "label": "d", "display": "د"},
        ],
    },
    "Figure-C-Robustness": {
        "layout": [["a"], ["b"]],
        "caption_fa": "شکل ۳. استحکام نتایج از طریق شبیه‌سازی مونت‌کارلو (K=۱۰,۰۰۰). (الف) Forest Plot مونت‌کارلو؛ همهٔ ۵ مسیر غیرمستقیم CI کاملاً سمت راست صفر دارند. (ب) مقایسهٔ مستقیم MC و SmartPLS؛ |Δ|<۰.۰۰۲ نشان‌دهندهٔ تطابق کامل است.",
        "caption_en": "Figure 3. Robustness via Monte Carlo (K=10,000). (a) MC Forest plot; all 5 indirect paths have CIs strictly right of zero. (b) Direct MC vs SmartPLS comparison; |Δ|<0.002 indicates perfect agreement.",
        "subplots": [
            {"id": "mc-16", "section": "monte-carlo", "label": "a", "display": "الف"},
            {"id": "mc-19", "section": "monte-carlo", "label": "b", "display": "ب"},
        ],
    },
}


# ============================================================
# توابع کمکی
# ============================================================
def fa_display(text):
    if not HAS_RESHAPER:
        return text
    if not any('\u0600' <= c <= '\u06FF' for c in text):
        return text
    return get_display(arabic_reshaper.reshape(text))


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass


def start_server(directory, port):
    os.chdir(directory)
    httpd = ThreadingHTTPServer(("127.0.0.1", port), QuietHandler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd


async def launch_browser(playwright):
    launch_args = ["--enable-webgl", "--use-gl=swiftshader",
                   "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
    attempts = [
        ("Chromium (Playwright)", {"headless": True, "args": launch_args}),
        ("Microsoft Edge",        {"headless": True, "channel": "msedge", "args": launch_args}),
        ("Google Chrome",         {"headless": True, "channel": "chrome", "args": launch_args}),
    ]
    for name, kwargs in attempts:
        try:
            print(f"🚀 تلاش برای راه‌اندازی: {name}...")
            browser = await playwright.chromium.launch(**kwargs)
            print(f"✅ موفق با: {name}\n")
            return browser
        except Exception:
            print(f"   ⚠️ {name} در دسترس نیست")
    print("\n❌ هیچ مرورگری پیدا نشد. playwright install chromium")
    sys.exit(1)


async def ensure_dark_theme(page):
    """اطمینان از تم تیره (همان‌طور که در داشبورد هست)"""
    print("🎨 اطمینان از تم تیره...")
    result = await page.evaluate("""
        () => {
            if (typeof state === 'undefined') return 'no-state';
            if (state.theme !== 'dark') {
                state.theme = 'dark';
                document.documentElement.dataset.theme = 'dark';
                const btn = document.getElementById('theme-btn');
                if (btn) btn.textContent = '🌙';
                if (typeof renderAll === 'function') renderAll();
                return 'switched-to-dark';
            }
            return 'already-dark';
        }
    """)
    print(f"   نتیجه: {result}")
    await asyncio.sleep(4)
    return result


def is_blank(img, threshold=5):
    small = img.convert("RGB").resize((64, 64))
    colors = small.getcolors(maxcolors=64 * 64)
    if colors is None:
        return False
    return len(colors) < threshold


async def extract_chart(page, chart_id, section):
    try:
        await page.click(f'.nav-btn[data-section="{section}"]', timeout=5000)
        await asyncio.sleep(0.5)
    except Exception as e:
        print(f"    [warn] nav: {e}")
    try:
        await page.wait_for_function(
            f"() => {{ const el = document.getElementById('{chart_id}'); "
            f"return el && el.data && el.data.length > 0; }}",
            timeout=30000,
        )
    except Exception as e:
        print(f"    [warn] wait: {e}")
    await asyncio.sleep(2.5)

    img = await _try_toimage(page, chart_id)
    if img and not is_blank(img):
        return img

    await page.evaluate(
        f"() => {{ const el = document.getElementById('{chart_id}'); "
        f"if(el) {{ el.style.width='2000px'; el.style.height='1500px'; }} }}"
    )
    await asyncio.sleep(2.0)
    img = await _try_toimage(page, chart_id)
    if img and not is_blank(img):
        return img

    try:
        el = page.locator(f"#{chart_id}")
        png = await el.screenshot(type="png")
        img = Image.open(io.BytesIO(png))
        if not is_blank(img):
            print(f"    [ok] {chart_id}: {img.size} (screenshot)")
            return img
    except Exception as e:
        print(f"    [warn] screenshot: {e}")
    return None


async def _try_toimage(page, chart_id):
    try:
        result = await page.evaluate(
            f"""
            async () => {{
                const el = document.getElementById('{chart_id}');
                if (!el || !el.data) return null;
                try {{
                    return await Plotly.toImage(el, {{
                        format:'png', width:2000, height:1400, scale:2
                    }});
                }} catch(e) {{ return 'ERR:'+e.message; }}
            }}
            """
        )
        if not result or result.startswith("ERR:"):
            if result: print(f"    [warn] {result}")
            return None
        b64 = result.split(",", 1)[1]
        img = Image.open(io.BytesIO(base64.b64decode(b64)))
        img.load()
        print(f"    [ok] {chart_id}: {img.size}")
        return img
    except Exception as e:
        print(f"    [warn] toImage: {e}")
        return None


def load_font(size):
    for c in ["C:/Windows/Fonts/arialbd.ttf",
              "C:/Windows/Fonts/calibrib.ttf",
              "C:/Windows/Fonts/tahomabd.ttf",
              "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/System/Library/Fonts/Helvetica.ttc"]:
        if os.path.exists(c):
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                pass
    return ImageFont.load_default()


def composite(fig_def, images):
    layout = fig_def["layout"]
    rows, cols = len(layout), max(len(r) for r in layout)
    cell_w = (FIG_WIDTH_PX - (cols + 1) * MARGIN) // cols
    cell_h = int(cell_w * 0.72)
    canvas_w = FIG_WIDTH_PX
    canvas_h = rows * cell_h + (rows + 1) * MARGIN
    canvas = Image.new("RGB", (canvas_w, canvas_h), CANVAS_BG)
    draw = ImageDraw.Draw(canvas)
    font = load_font(SUBLABEL_SIZE)
    label_to_sub = {sp["label"]: sp for sp in fig_def["subplots"]}

    for r, row in enumerate(layout):
        for c, label_key in enumerate(row):
            x0 = MARGIN + c * (cell_w + MARGIN)
            y0 = MARGIN + r * (cell_h + MARGIN)
            sp = label_to_sub.get(label_key)
            if not sp:
                continue
            img = images.get(sp["id"])
            display = fa_display(sp.get("display", label_key))

            if img is None:
                draw.rectangle([x0, y0, x0 + cell_w, y0 + cell_h],
                               fill=EMPTY_FILL, outline=BORDER_COLOR, width=BORDER_WIDTH)
                draw.text((x0 + 20, y0 + 20), f"{display} — {sp['id']}",
                          fill="#8B94A7", font=font)
                continue

            avail_w = cell_w - 2 * CELL_PADDING
            avail_h = cell_h - 2 * CELL_PADDING
            iw, ih = img.size
            ar = iw / ih
            nw = avail_w
            nh = int(nw / ar)
            if nh > avail_h:
                nh = avail_h
                nw = int(nh * ar)
            resized = img.resize((nw, nh), Image.LANCZOS)
            img_x = x0 + CELL_PADDING + (avail_w - nw) // 2
            img_y = y0 + CELL_PADDING + (avail_h - nh) // 2
            canvas.paste(resized, (img_x, img_y))
            draw.rectangle([img_x - 1, img_y - 1, img_x + nw, img_y + nh],
                           outline=BORDER_COLOR, width=BORDER_WIDTH)
            draw.text((x0 + 6, y0 + 2), display, fill=LABEL_COLOR, font=font)

    return canvas


async def main(dashboard_dir, output_dir, port):
    dashboard_dir = Path(dashboard_dir).resolve()
    output_dir = Path(output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    raw_dir = output_dir / "raw"
    raw_dir.mkdir(exist_ok=True)

    required = ["index.html", "app.js", "data.js", "loader.js", "style.css"]
    for f in required:
        if not (dashboard_dir / f).exists():
            print(f"❌ فایل پیدا نشد: {dashboard_dir / f}")
            sys.exit(1)
    print(f"✅ فایل‌ها موجودند در {dashboard_dir}")

    if not HAS_RESHAPER:
        print("\n⚠️  pip install arabic-reshaper python-bidi\n")

    print(f"🌐 شروع سرور محلی روی پورت {port}")
    httpd = start_server(str(dashboard_dir), port)
    await asyncio.sleep(0.5)

    try:
        async with async_playwright() as p:
            browser = await launch_browser(p)
            context = await browser.new_context(
                viewport={"width": 1920, "height": 1080},
                locale="fa-IR",
            )
            page = await context.new_page()
            url = f"http://127.0.0.1:{port}/index.html"
            print(f"📂 باز کردن {url}")
            await page.goto(url, wait_until="domcontentloaded")
            await asyncio.sleep(4)

            await ensure_dark_theme(page)

            all_subs = []
            for fd in FIGURES.values():
                all_subs.extend(fd["subplots"])
            seen, uniq = set(), []
            for sp in all_subs:
                if sp["id"] not in seen:
                    seen.add(sp["id"])
                    uniq.append(sp)

            images = {}
            print(f"\n📸 استخراج {len(uniq)} نمودار...\n")
            for i, sp in enumerate(uniq, 1):
                display = sp.get("display", sp["label"])
                print(f"  [{i}/{len(uniq)}] {display}) {sp['id']}")
                img = await extract_chart(page, sp["id"], sp["section"])
                if img is not None:
                    images[sp["id"]] = img
                    img.save(raw_dir / f"{sp['id']}.png", "PNG")

            await browser.close()

            print("\n" + "=" * 60)
            print("🎨 ساخت Composite Figures...\n")
            for fig_name, fd in FIGURES.items():
                print(f"  → {fig_name}")
                comp = composite(fd, images)
                out = output_dir / f"{fig_name}.png"
                comp.save(out, "PNG", dpi=(DPI, DPI))
                w_mm = comp.size[0] / DPI * 25.4
                h_mm = comp.size[1] / DPI * 25.4
                print(f"    ✅ {out.name}  ({comp.size[0]}×{comp.size[1]} px · {w_mm:.0f}×{h_mm:.0f} mm · {DPI} dpi)")

            cap_path = output_dir / "captions.txt"
            with open(cap_path, "w", encoding="utf-8") as f:
                f.write("=" * 70 + "\nCAPTIONS\n" + "=" * 70 + "\n\n")
                for name, fd in FIGURES.items():
                    f.write(f"■ {name}.png\n")
                    f.write(f"\n  FA: {fd['caption_fa']}\n")
                    f.write(f"\n  EN: {fd['caption_en']}\n\n")
                    f.write("-" * 70 + "\n\n")
            print(f"  ✅ کپشن‌ها: {cap_path.name}")

            print("\n🎉 تمام شد!")
            print(f"📁 خروجی: {output_dir}")

    finally:
        httpd.shutdown()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dashboard-dir", default=".")
    parser.add_argument("--output-dir", default="./figures")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    asyncio.run(main(args.dashboard_dir, args.output_dir, args.port))