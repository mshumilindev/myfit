import html
CSS = """
:root{--bg:#eceff4;--panel:#fff;--ink:#0e1726;--mut:#5b6678;--line:#d9dee7;--bar:#12172b;--acc:#2f5bff;--acc2:#e8edff;
--ok:#0f9d58;--okbg:#e3f6ec;--warn:#c77700;--warnbg:#fff1d6;--bad:#d8283a;--badbg:#fde5e8;--idle:#8b95a7;--lime:#c6ff3d;
--mono:ui-monospace,"JetBrains Mono","DejaVu Sans Mono",Menlo,monospace;--sans:"Inter","Segoe UI",system-ui,-apple-system,Arial,sans-serif}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.45 var(--sans)}
.top{height:48px;background:var(--bar);color:#fff;display:flex;align-items:center;gap:14px;padding:0 18px;position:sticky;top:0}
.logo{font:700 15px var(--mono);letter-spacing:.04em}.pill{background:var(--lime);color:#111;font:700 11px var(--mono);padding:3px 8px;border-radius:4px;letter-spacing:.08em}
.top .sp{flex:1}.top .m{font:12px var(--mono);color:#aab3cc}.live{display:inline-flex;gap:6px;align-items:center;font:12px var(--mono);color:#aab3cc}.live i{width:8px;height:8px;border-radius:50%;background:#37e08a;box-shadow:0 0 0 3px #37e08a33}
.wrap{display:grid;grid-template-columns:272px 1fr;min-height:calc(100vh - 48px)}
.rail{background:#f8f9fc;border-right:1px solid var(--line);padding:14px 10px;display:flex;flex-direction:column;gap:4px}
.rail h6{margin:14px 8px 4px;font:700 10.5px var(--mono);letter-spacing:.1em;color:var(--mut);text-transform:uppercase}
.lane{display:grid;grid-template-columns:10px 1fr auto;gap:9px;align-items:center;padding:8px 10px;border-radius:8px;border:1px solid transparent;color:var(--ink)}
.lane.on{background:#fff;border-color:var(--acc);box-shadow:0 1px 0 #0001, 0 0 0 3px var(--acc2)}
.lane .n{font:600 13px var(--mono)}.lane .s{font-size:11.5px;color:var(--mut)}.lane .p{font:12px var(--mono);color:var(--mut)}
.led{width:10px;height:10px;border-radius:50%}.ok{background:var(--ok)}.wn{background:var(--warn)}.bd{background:var(--bad)}.id{background:var(--idle)}
.bar{grid-column:2/4;height:4px;background:#e3e7ee;border-radius:3px;margin-top:5px;overflow:hidden}.bar b{display:block;height:100%;background:var(--acc)}
.main{padding:20px 26px 40px;display:flex;flex-direction:column;gap:16px;min-width:0}
.head{display:flex;justify-content:space-between;align-items:flex-end}.head h1{margin:0;font:700 24px var(--sans);letter-spacing:-.01em}.head .sub{color:var(--mut);font:12px var(--mono)}
.tabs{display:flex;gap:2px;border-bottom:2px solid var(--line)}.tabs a{padding:9px 14px;font:600 13px var(--sans);color:var(--mut);border-bottom:3px solid transparent;margin-bottom:-2px}.tabs a.on{color:var(--acc);border-color:var(--acc)}
.banner{display:flex;gap:10px;align-items:center;padding:10px 14px;border-radius:8px;font-weight:600}.banner.w{background:var(--warnbg);color:#6b4100;border:1px solid #f0cf8a}.banner.b{background:var(--badbg);color:#7b1220;border:1px solid #f1b3bb}
.kpis{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}
.kpi{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;position:relative}
.kpi .l{font:600 11px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--mut)}.kpi .v{font:700 28px var(--mono);margin-top:4px;letter-spacing:-.02em}.kpi .v small{font-size:13px;color:var(--mut);font-weight:500}
.kpi .d{font:12px var(--mono);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.up{color:var(--ok)}.dn{color:var(--bad)}.fl{color:var(--mut)}
.kpi.bad{border-color:#f1b3bb;background:linear-gradient(#fff,#fff6f7)}.kpi.warn{border-color:#f0cf8a;background:linear-gradient(#fff,#fffaf0)}
.kpi svg{position:absolute;right:12px;top:14px;opacity:.9}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;overflow:hidden}.card>h3{margin:0;padding:11px 14px;border-bottom:1px solid var(--line);font:700 12px var(--mono);letter-spacing:.07em;text-transform:uppercase;display:flex;justify-content:space-between}
.card>h3 em{font-style:normal;color:var(--mut);font-weight:500;text-transform:none;letter-spacing:0}
.cols{display:grid;grid-template-columns:1.6fr 1fr;gap:16px}
table{width:100%;border-collapse:collapse;font-size:13px}th{position:sticky;top:0;background:#f5f7fb;text-align:left;font:600 11px var(--mono);color:var(--mut);text-transform:uppercase;letter-spacing:.05em;padding:8px 12px;border-bottom:1px solid var(--line)}
td{white-space:nowrap;padding:9px 12px;border-bottom:1px solid #edf0f5}tr:nth-child(even) td{background:#fafbfd}td.r,th.r{text-align:right;font-family:var(--mono)}td.b{font-weight:600}
.t{display:inline-block;font:700 11px var(--mono);padding:2px 7px;border-radius:4px;letter-spacing:.03em}.t.ok{background:var(--okbg);color:#0a6b3b}.t.wn{background:var(--warnbg);color:#8a5200}.t.bd{background:var(--badbg);color:#a01728}.t.id{background:#eef0f4;color:#4a5466}.t.ac{background:var(--acc2);color:#1d3fd1}
.lk{color:var(--acc);font:600 12px var(--mono);text-decoration:none}
.att{display:grid;grid-template-columns:22px 1fr auto;gap:10px;padding:11px 14px;border-bottom:1px solid #edf0f5;align-items:start}.att b{display:block;font-size:13.5px}.att span{color:var(--mut);font-size:12.5px}
.ico{width:22px;height:22px;border-radius:6px;display:grid;place-items:center;font:700 13px var(--mono);color:#fff}
.strip{padding:14px}.strip .rowl{display:grid;grid-template-columns:110px 1fr;gap:10px;align-items:center;margin-bottom:10px}.strip .rowl>span{font:600 12px var(--mono)}
.track{position:relative;height:26px;background:#eef1f6;border-radius:6px;overflow:hidden}.track i{position:absolute;top:0;bottom:0;display:block}.track .nd{top:-2px;bottom:-2px;width:2px;background:#111}
.axis{display:grid;grid-template-columns:110px 1fr;gap:10px}.axis div{display:flex;justify-content:space-between;font:11px var(--mono);color:var(--mut)}
.legend{display:flex;gap:16px;padding:0 14px 14px;font:12px var(--mono);color:var(--mut);flex-wrap:wrap}.legend i{display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-2px}
"""
def spark(vals,color):
    w,h=84,26;mx=max(vals) or 1;pts=" ".join(f"{i*w/(len(vals)-1):.1f},{h-2-(v/mx)*(h-6):.1f}" for i,v in enumerate(vals))
    return f'<svg width="{w}" height="{h}"><polyline fill="none" stroke="{color}" stroke-width="2" points="{pts}"/></svg>'
def kpi(l,v,d="",cls="",dcls="fl",sp=None,col="#2f5bff",unit=""):
    return f'<div class="kpi {cls}"><div class="l">{l}</div><div class="v">{v}<small>{unit}</small></div><div class="d {dcls}">{d}</div>{spark(sp,col) if sp else ""}</div>'
def tag(c,t): return f'<span class="t {c}">{t}</span>'
def shell(active, tab, body, tabs=True):
    lanes=[("overall","Σ","Overall","all branches","", "ok",None,None)]
    def lane(key,name,sub,led,pct):
        on=" on" if key==active else ""
        return f'<div class="lane{on}"><span class="led {led}"></span><div><div class="n">{name}</div><div class="s">{sub}</div></div><span class="p">{pct}</span><div class="bar"><b style="width:{pct}"></b></div></div>'
    rail=f'<div class="lane{" on" if active=="overall" else ""}"><span class="led ok"></span><div><div class="n">Σ Overall</div><div class="s">5 branches · averages</div></div><span class="p">61%</span></div>'
    rail+='<h6>⚑ Waiting for cpd · 2</h6>'+lane("c607","ready-for-cpd/SPO-607","store modules · 26 h","wn","100%")+lane("c611","ready-for-cpd/SPO-611","sleep · behind main 2","wn","100%")
    rail+='<h6>In work · 3</h6>'+lane("b639","SPO-639","workflow · 7 h 40 m","wn","85%")+lane("b635","SPO-635","Solstice theme · 2 d","ok","60%")+lane("b609","SPO-609","screens coverage · 3 d","bd","35%")
    rail+='<h6>Trunk</h6>'+lane("main","main · CI","12% red · 8 m 40 s","bd","—")
    tb=""
    if tabs:
        names=["Overview","Plan & AC","Pauses & flow","Runs","CI","Quality","Risks","Release"]
        tb='<div class="tabs">'+"".join(f'<a class="{"on" if n==tab else ""}">{n}</a>' for n in names)+'</div>'
    return f'<!doctype html><html><head><meta charset=utf8><style>{CSS}</style></head><body><div class="top"><span class="logo">SPOTTER//DEV</span><span class="pill">DEV CONSOLE</span><span class="m">localhost:5174 · read-only</span><span class="sp"></span><span class="live"><i></i>live · updated 00:02:14</span></div><div class="wrap"><aside class="rail">{rail}</aside><main class="main">{body}{""}</main></div></body></html>'.replace('<main class="main">','<main class="main">'+"__TABS__").replace("__TABS__",tb and "" )
def page(active,title,sub,tab,inner,tabs=True):
    tb=""
    if tabs:
        names=["Overview","Plan & AC","Pauses & flow","Runs","CI","Quality","Risks","Release"]
        tb='<div class="tabs">'+"".join(f'<a class="{"on" if n==tab else ""}">{n}</a>' for n in names)+'</div>'
    head=f'<div class="head"><div><h1>{title}</h1><div class="sub">{sub}</div></div><div class="sub">auto-refresh 5 s · all branches in work + ready-for-cpd</div></div>'
    return shell(active,tab,head+tb+inner,False)
def row(*c): return "<tr>"+"".join(c)+"</tr>"
# OVERALL
kp="".join([kpi("Branches in work","5","2 waiting for cpd",sp=[3,4,4,5,5,5,5]),kpi("Avg progress","61<small>%</small>","▲ 6 pt vs yesterday","", "up",[30,38,41,48,52,55,61],"#0f9d58"),
 kpi("Red branches","3","SPO-609 · SPO-639 · main","bad","dn",[0,1,1,2,2,3,3],"#d8283a"),kpi("Unforced stops","17","▲ 4 vs yesterday","bad","dn",[2,3,2,4,3,5,6],"#d8283a"),
 kpi("CI median","8<small>m</small> 40<small>s</small>","target 5 m · +3 m 40 s","warn","dn",[12,11,9,10,9,9,8.6],"#c77700"),kpi("Avg commit → prod","34<small>m</small>","▼ 6 m faster","","up",[50,48,45,41,40,38,34],"#0f9d58")])
br="".join([
 row('<td class="b">⚑ ready-for-cpd/SPO-607</td>','<td>store modules <a class="lk">SPO-607 ↗</a></td>','<td>'+tag("wn","READY · 26 h")+'</td>','<td class="r">100%</td>','<td class="r">31/31</td>','<td>'+tag("ok","GREEN")+'</td>','<td class="r">0</td>'),
 row('<td class="b">⚑ ready-for-cpd/SPO-611</td>','<td>sleep <a class="lk">SPO-611 ↗</a></td>','<td>'+tag("wn","READY · BEHIND 2")+'</td>','<td class="r">100%</td>','<td class="r">12/12</td>','<td>'+tag("ok","GREEN")+'</td>','<td class="r">0</td>'),
 row('<td class="b">SPO-639</td>','<td>workflow <a class="lk">SPO-639 ↗</a></td>','<td>'+tag("ac","IN PROGRESS")+'</td>','<td class="r">85%</td>','<td class="r">14/31</td>','<td>'+tag("bd","1 RED")+'</td>','<td class="r">9</td>'),
 row('<td class="b">SPO-635</td>','<td>Solstice theme <a class="lk">SPO-635 ↗</a></td>','<td>'+tag("ac","IN PROGRESS")+'</td>','<td class="r">60%</td>','<td class="r">9/15</td>','<td>'+tag("ok","GREEN")+'</td>','<td class="r">3</td>'),
 row('<td class="b">SPO-609</td>','<td>screens coverage <a class="lk">SPO-609 ↗</a></td>','<td>'+tag("ac","IN PROGRESS")+'</td>','<td class="r">35%</td>','<td class="r">5/14</td>','<td>'+tag("bd","2 RED")+'</td>','<td class="r">5</td>')])
att=lambda c,i,t,s,tg:f'<div class="att"><span class="ico {c}">{i}</span><div><b>{t}</b><span>{s}</span></div>{tg}</div>'
inner=f'''<div class="banner w">⚑ 2 branches wait for cpd (oldest 26 h) · 15 unpushed commits on main · nothing is lost: both are pinned in the left rail</div>
<div class="kpis">{kp}</div>
<div class="cols"><div class="card"><h3>All branches in work <em>sorted by risk</em></h3><table><tr><th>Branch</th><th>Task</th><th>State</th><th class="r">Plan</th><th class="r">AC</th><th>Checks</th><th class="r">Stops</th></tr>{br}</table></div>
<div class="card"><h3>Needs attention <em>6 across branches</em></h3>
{att("bd","!","SPO-609: 2 red checks","layout audit · hero geometry",tag("bd","RED"))}{att("wn","⏱","ready-for-cpd/SPO-607 is 26 h old","ship with the next cpd",tag("wn","STALE"))}{att("wn","↓","ready-for-cpd/SPO-611 behind main by 2","rebase before cpd",tag("wn","BEHIND"))}{att("wn","◔","CI over budget: client tests 5/8","median 6 m 40 s vs 4 m cap",tag("wn","SLOW"))}{att("id","⏸","SPO-639: 6 items wait on you","design approval · cpd · Linear key",tag("id","BLOCKED"))}{att("bd","⚠","17 unforced stops in 24 h","chat stopped with open items; see Pauses",tag("bd","FLOW"))}</div></div>'''
open('overall.html','w').write(page("overall","Overall","5 branches in work · 2 waiting for cpd","", inner,False))
# BRANCH PAUSES
def seg(l,w,c,t=""): return f'<i style="left:{l}%;width:{w}%;background:{c}" title="{t}"></i>'
def nd(l): return f'<i class="nd" style="left:{l}%"></i>'
work="#2f5bff";unf="#d8283a";leg="#0f9d58";cmp="#8b95a7";cpd="#c77700"
t1=seg(2,18,work)+seg(20,3,unf)+seg(23,22,work)+seg(45,6,unf)+seg(51,12,work)+seg(63,4,cmp)+seg(67,10,work)+seg(77,9,leg)+seg(86,6,work)+seg(92,6,unf)+nd(23)+nd(51)+nd(92)+nd(86)
t2=seg(5,10,work)+seg(15,2,cpd)+seg(17,12,work)+seg(29,5,unf)+seg(34,20,work)+seg(54,8,leg)+seg(62,30,work)+nd(34)+nd(62)
t3=seg(8,30,work)+seg(38,4,unf)+seg(42,25,work)+seg(67,5,cpd)+seg(72,20,work)+nd(42)+nd(72)
rows="".join([row('<td class="b">00:01</td>','<td>Stop</td>','<td>owner nudge: design feedback</td>','<td class="r">4</td>','<td>'+tag("wn","FORCED")+'</td>','<td class="r">2 m</td>'),
 row('<td class="b">23:49</td>','<td>Stop</td>','<td>legit blocker (design approval)</td>','<td class="r">0</td>','<td>'+tag("ok","LEGIT")+'</td>','<td class="r">1 m</td>'),
 row('<td class="b">22:31</td>','<td>Stop</td>','<td>open items, no blocker</td>','<td class="r">3</td>','<td>'+tag("bd","UNFORCED")+'</td>','<td class="r">14 m</td>'),
 row('<td class="b">21:07</td>','<td>Compaction</td>','<td>context limit</td>','<td class="r">5</td>','<td>'+tag("id","PLATFORM")+'</td>','<td class="r">—</td>'),
 row('<td class="b">20:40</td>','<td>Stop</td>','<td>open items, no blocker</td>','<td class="r">6</td>','<td>'+tag("bd","UNFORCED")+'</td>','<td class="r">22 m</td>'),
 row('<td class="b">19:12</td>','<td>Stop</td>','<td>waiting for cpd</td>','<td class="r">2</td>','<td>'+tag("ok","LEGIT")+'</td>','<td class="r">41 m</td>')])
kp2="".join([kpi("Unforced stops","9","▲ 3 vs yesterday","bad","dn",[1,2,1,3,2,4,9],"#d8283a"),kpi("Owner nudges","11","you had to say “continue”","bad","dn",[2,1,3,2,4,5,11],"#d8283a"),kpi("Median pause","14<small>m</small>","until your next message","warn","fl"),
 kpi("Total idle","3<small>h</small> 02<small>m</small>","of 7 h 40 m lead time","warn","fl"),kpi("Legit blockers","3","design · cpd · access","","fl"),kpi("Compactions","2","context limit","","fl")])
inner2=f'''<div class="banner b">✖ 9 stops with open, unblocked items in 24 h · 11 owner nudges · each red marker below is a place where work stopped without a blocker</div>
<div class="kpis">{kp2}</div>
<div class="card"><h3>Work timeline · last 24 h <em>one lane per branch; black tick = your message</em></h3><div class="strip">
<div class="rowl"><span>SPO-639</span><div class="track">{t1}</div></div><div class="rowl"><span>SPO-635</span><div class="track">{t2}</div></div><div class="rowl"><span>SPO-609</span><div class="track">{t3}</div></div>
<div class="axis"><span></span><div><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>now</span></div></div></div>
<div class="legend"><span><i style="background:{work}"></i>working</span><span><i style="background:{unf}"></i>unforced stop</span><span><i style="background:{leg}"></i>legit blocker</span><span><i style="background:{cpd}"></i>waiting for cpd</span><span><i style="background:{cmp}"></i>compaction</span></div></div>
<div class="card"><h3>Stop log · SPO-639 <em>category only, no message text</em></h3><table><tr><th>Time</th><th>Event</th><th>Reason</th><th class="r">Open</th><th>Class</th><th class="r">Until next msg</th></tr>{rows}</table></div>'''
open('pauses.html','w').write(page("b639","SPO-639 · workflow","Linear SPO-639 ↗ · branch spo-639 · 4 commits ahead","Pauses & flow",inner2))
