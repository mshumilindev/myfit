import sys, json, glob, os, asyncio
from playwright.async_api import async_playwright
async def main(pat):
    os.makedirs('shots', exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        for f in sorted(glob.glob('project/'+pat)):
            src=open(f).read()
            import re
            w,h=map(int,re.search(r'"width":(\d+),"height":(\d+)',src).groups())
            await pg.set_viewport_size({'width':w,'height':h})
            await pg.goto('file://'+os.path.abspath(f)); await pg.wait_for_timeout(300)
            await pg.screenshot(path='shots/'+os.path.basename(f).replace('.dc.html','.png'))
        await b.close()
asyncio.run(main(sys.argv[1]))
