"""Spotter Glass Kit — the ONLY source of components for the brass-glass redesign.

Rules for every screen script:
  * import kit as k; build markup ONLY with k.* functions (+ k.row/k.col/k.grid for layout, k.txt for text).
  * never write CSS or colour values yourself; use tone names: brass, ok, bad, rest, sleep, sport, kcal, neutral.
  * one artboard = k.board(file, title, w, h, html, row=..., page=...).
"""
import json, os, html as _html

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'project')
MAN = os.path.join(ROOT, 'manifests')
os.makedirs(OUT, exist_ok=True)
os.makedirs(MAN, exist_ok=True)

# ---------------------------------------------------------------- tokens
T = dict(
    bg='#121316', ink='#e9eaec', ink2='#d0d3d6', mut='#b0b4b8', dim='#90959a', line='#3b3f43',
    brass='#d9a24f', brass3='#eed3a5', brass7='#8a642e', ok='#4cbe8c', ok3='#b7e8cf', bad='#e2564f', bad3='#f3c2bf',
    rest='#33a8e0', rest3='#93d4f2', sleep='#9d8cf0', sleep3='#d6cffa', sport='#a8dc7c', kcal='#3d84c9', kcal3='#cbe0f6',
)
TONE = {  # (glyph colour, tile background, tile ring)
    'brass': ('#eed3a5', 'rgba(217,162,79,.16)', 'rgba(217,162,79,.45)'),
    'ok': ('#b7e8cf', 'rgba(76,190,140,.15)', 'rgba(76,190,140,.4)'),
    'bad': ('#f3c2bf', 'rgba(226,86,79,.15)', 'rgba(226,86,79,.42)'),
    'rest': ('#93d4f2', 'rgba(51,168,224,.15)', 'rgba(51,168,224,.4)'),
    'sleep': ('#d6cffa', 'rgba(157,140,240,.16)', 'rgba(157,140,240,.42)'),
    'sport': ('#cfeeb2', 'rgba(168,220,124,.14)', 'rgba(168,220,124,.4)'),
    'kcal': ('#cbe0f6', 'rgba(61,132,201,.16)', 'rgba(61,132,201,.42)'),
    'neutral': ('#d0d3d6', 'rgba(233,234,236,.07)', 'rgba(233,234,236,.14)'),
    # app colour families (styles.css --color-*; components/ui/tones.css) — colour-coding is deliberate, keep it
    'illness': ('#f9d7b6', 'rgba(240,163,94,.16)', 'rgba(240,163,94,.45)'),
    'injury': ('#f5c9c2', 'rgba(226,120,106,.16)', 'rgba(226,120,106,.45)'),
    'active': ('#bfeadb', 'rgba(92,200,168,.15)', 'rgba(92,200,168,.42)'),
    'apex': ('#d9c9fb', 'rgba(157,111,240,.17)', 'rgba(157,111,240,.45)'),
    'learn': ('#f9c4d3', 'rgba(229,83,126,.16)', 'rgba(229,83,126,.45)'),
    'atlas': ('#f3c1bb', 'rgba(208,88,77,.16)', 'rgba(208,88,77,.45)'),
    'danger': ('#f3c2bf', 'rgba(226,86,79,.15)', 'rgba(226,86,79,.42)'),
}
ACCENT = {'brass': '#d9a24f', 'ok': '#4cbe8c', 'bad': '#e2564f', 'rest': '#93d4f2', 'sleep': '#9d8cf0',
          'sport': '#a8dc7c', 'kcal': '#3d84c9', 'neutral': '#90959a', 'illness': '#f0a35e', 'injury': '#e2786a',
          'active': '#5cc8a8', 'apex': '#9d6ff0', 'learn': '#e5537e', 'atlas': '#d0584d', 'danger': '#e2564f',
          'under': '#71767b', 'productive': '#4cbe8c', 'high': '#d9a24f', 'over': '#e2564f'}

CSS = r"""
body{margin:0;font-family:'Inter',system-ui,sans-serif;background:#0f1012;color:#e9eaec;-webkit-font-smoothing:antialiased}
*{box-sizing:border-box}
button{font:inherit;color:inherit;background:none;border:0;padding:0;cursor:pointer}
input{font:inherit;color:inherit}
svg{flex:none}
.num{font-variant-numeric:tabular-nums}
.t-d1{font-size:34px;font-weight:600;letter-spacing:-.025em;line-height:1.08}
.t-h1{font-size:26px;font-weight:600;letter-spacing:-.02em;line-height:1.15}
.t-h2{font-size:20px;font-weight:600;letter-spacing:-.01em;line-height:1.2}
.t-h3{font-size:16px;font-weight:600;line-height:1.3}
.t-b{font-size:15px;line-height:1.45}
.t-s{font-size:13px;line-height:1.4;color:#b0b4b8}
.t-m{font-size:12px;line-height:1.35;color:#90959a}
.t-l{font-size:10.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#b0b4b8}
.t-big{font-size:44px;font-weight:600;letter-spacing:-.03em;line-height:1}
.c-mut{color:#b0b4b8}.c-dim{color:#90959a}.c-brass{color:#eed3a5}.c-ok{color:#4cbe8c}.c-bad{color:#f3c2bf}.c-rest{color:#93d4f2}.c-sleep{color:#d6cffa}
.scr{position:relative;overflow:hidden;background:radial-gradient(90% 40% at 80% 100%,rgba(138,100,46,.45),transparent 70%),radial-gradient(70% 32% at 8% 96%,rgba(43,31,58,.75),transparent 70%),radial-gradient(80% 28% at 92% 0%,rgba(138,100,46,.22),transparent 70%),#121316}
.m-art{background:radial-gradient(80% 42% at 22% 14%,rgba(43,31,58,.95),transparent 70%),radial-gradient(90% 55% at 88% 34%,rgba(138,100,46,.8),transparent 70%),radial-gradient(90% 45% at 50% 96%,rgba(52,39,19,.9),transparent 70%),#121316}
.m-rest{background:radial-gradient(90% 42% at 80% 100%,rgba(28,111,154,.45),transparent 70%),radial-gradient(70% 32% at 8% 96%,rgba(43,31,58,.7),transparent 70%),radial-gradient(80% 30% at 92% 0%,rgba(51,168,224,.18),transparent 70%),#111417}
.m-sleep{background:radial-gradient(90% 45% at 75% 0%,rgba(90,70,170,.5),transparent 70%),radial-gradient(80% 40% at 10% 100%,rgba(43,31,58,.85),transparent 70%),#0f0f16}
.m-ok{background:radial-gradient(90% 50% at 50% 28%,rgba(76,190,140,.26),transparent 70%),radial-gradient(80% 50% at 60% 40%,rgba(138,100,46,.45),transparent 70%),radial-gradient(70% 30% at 8% 96%,rgba(43,31,58,.7),transparent 70%),#0f1311}
.m-bad{background:radial-gradient(90% 40% at 80% 100%,rgba(125,48,43,.45),transparent 70%),radial-gradient(70% 32% at 8% 96%,rgba(43,31,58,.7),transparent 70%),#131112}
.m-night{background:radial-gradient(120% 70% at 30% 10%,#2a2f36 0%,#111214 60%,#0a0a0b 100%)}
.body{padding:12px 16px 24px;display:flex;flex-direction:column;gap:14px}
/* surfaces */
.card{background:rgba(31,33,37,.72);border:1px solid rgba(233,234,236,.07);border-radius:18px}
.card.glass{background:linear-gradient(180deg,rgba(60,48,30,.38),rgba(20,18,14,.58));border:0;box-shadow:inset 0 1.2px .5px rgba(238,211,165,.45),inset 0 0 0 1px rgba(217,162,79,.26)}
.card.ok{background:linear-gradient(180deg,rgba(40,80,60,.38),rgba(14,26,20,.6));border:0;box-shadow:inset 0 1.2px .5px rgba(183,232,207,.42),inset 0 0 0 1px rgba(76,190,140,.3)}
.card.bad{background:linear-gradient(180deg,rgba(90,34,30,.38),rgba(30,14,12,.6));border:0;box-shadow:inset 0 1.2px .5px rgba(243,194,191,.38),inset 0 0 0 1px rgba(226,86,79,.32)}
.card.rest{background:linear-gradient(180deg,rgba(28,70,100,.36),rgba(10,26,38,.58));border:0;box-shadow:inset 0 1.2px .5px rgba(147,212,242,.42),inset 0 0 0 1px rgba(51,168,224,.3)}
.card.sleep{background:linear-gradient(180deg,rgba(60,50,110,.36),rgba(20,16,38,.58));border:0;box-shadow:inset 0 1.2px .5px rgba(214,207,250,.4),inset 0 0 0 1px rgba(157,140,240,.3)}
.card.dash{background:transparent;border:1px dashed rgba(233,234,236,.18)}
.pad{padding:14px 16px}
/* list */
.li{display:flex;align-items:center;gap:12px;min-height:52px;padding:8px 16px;border-top:1px solid rgba(233,234,236,.07)}
.li:first-child{border-top:0}
.li .tt{flex:1;min-width:0}
.li .t1{font-size:15px;line-height:1.3}
.li .t2{font-size:12.5px;color:#90959a;line-height:1.35;margin-top:1px}
.li .tr{font-size:14px;color:#b0b4b8;display:flex;align-items:center;gap:8px}
/* tiles & avatars */
.tile{width:36px;height:36px;border-radius:11px;display:flex;align-items:center;justify-content:center;flex:none}
.tile.lg{width:48px;height:48px;border-radius:14px}
.av{border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;color:#eed3a5;background:linear-gradient(135deg,#342713,#8a642e);box-shadow:inset 0 0 0 1px rgba(238,211,165,.35);flex:none}
.atlas{border-radius:50%;background:radial-gradient(circle at 40% 35%,#6b4a3f,#2a1d19 72%);box-shadow:0 0 0 2px #d0584d;flex:none}
.art{border-radius:10px;background:linear-gradient(135deg,#2b1f3a 0%,#8a642e 55%,#eed3a5 100%);flex:none}
.house{background:repeating-linear-gradient(135deg,rgba(255,255,255,.035) 0 2px,transparent 2px 11px),linear-gradient(90deg,#23262a,#1a1c20)}
/* buttons */
.btn{height:48px;padding:0 22px;border-radius:24px;font-size:15px;font-weight:600;display:inline-flex;align-items:center;justify-content:center;gap:8px;white-space:nowrap}
.btn.sm{height:36px;padding:0 14px;border-radius:18px;font-size:13.5px}
.btn.full{width:100%}
.btn.pri{background:rgba(217,162,79,.18);box-shadow:inset 0 0 0 1px rgba(217,162,79,.62);color:#eed3a5}
.btn.sec{background:rgba(233,234,236,.08);color:#e9eaec;font-weight:500}
.btn.ok{background:rgba(76,190,140,.16);box-shadow:inset 0 0 0 1px rgba(76,190,140,.55);color:#b7e8cf}
.btn.dan{background:rgba(226,86,79,.14);box-shadow:inset 0 0 0 1px rgba(226,86,79,.55);color:#f3c2bf}
.btn.txt{height:44px;padding:0 6px;color:#e4bb76;font-weight:600}
.btn.dis{opacity:.4}
.ib{width:44px;height:44px;border-radius:22px;display:inline-flex;align-items:center;justify-content:center;color:#e9eaec;flex:none}
.ib.fill{background:rgba(233,234,236,.08)}
.ib.pri{background:rgba(217,162,79,.18);box-shadow:inset 0 0 0 1px rgba(217,162,79,.62);color:#eed3a5}
.ib.sm{width:36px;height:36px}
/* chips / tags / segmented */
.chip{height:34px;padding:0 14px;border-radius:17px;font-size:13px;display:inline-flex;align-items:center;gap:6px;background:rgba(233,234,236,.07);color:#d0d3d6;white-space:nowrap}
.chip.on{background:rgba(217,162,79,.2);box-shadow:inset 0 0 0 1px rgba(217,162,79,.6);color:#eed3a5}
.tag{height:22px;padding:0 8px;border-radius:11px;font-size:11px;font-weight:600;display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
.seg{display:flex;padding:3px;border-radius:14px;background:rgba(10,10,12,.45);border:1px solid rgba(233,234,236,.08)}
.seg button{flex:1;height:34px;border-radius:11px;font-size:13.5px;color:#b0b4b8;white-space:nowrap;padding:0 8px}
.seg button.on{background:rgba(217,162,79,.2);box-shadow:inset 0 0 0 1px rgba(217,162,79,.55);color:#eed3a5;font-weight:600}
/* inputs */
.field{min-height:50px;border-radius:14px;background:rgba(10,10,12,.45);border:1px solid rgba(233,234,236,.1);padding:0 14px;display:flex;align-items:center;gap:10px;font-size:15px}
.field input{background:none;border:0;outline:0;flex:1;min-width:0;height:48px;padding:0;color:#e9eaec}
.field.focus{border-color:rgba(217,162,79,.7);box-shadow:0 0 0 3px rgba(217,162,79,.14)}
.field.err{border-color:rgba(226,86,79,.7);box-shadow:0 0 0 3px rgba(226,86,79,.14)}
.flabel{font-size:12.5px;color:#b0b4b8;margin-bottom:6px}
.ferr{font-size:12.5px;color:#f3c2bf;margin-top:6px}
.tg{width:48px;height:28px;border-radius:14px;background:rgba(233,234,236,.12);position:relative;flex:none;display:inline-block}
.tg span{position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:11px;background:#d0d3d6}
.tg.on{background:rgba(217,162,79,.4);box-shadow:inset 0 0 0 1px rgba(217,162,79,.7)}
.tg.on span{left:23px;background:#eed3a5}
.step{display:flex;align-items:center;gap:6px}
.step .v{min-width:86px;text-align:center}
.chk{width:22px;height:22px;border-radius:7px;border:1.5px solid #55595e;display:inline-flex;align-items:center;justify-content:center;flex:none}
.chk.on{background:rgba(217,162,79,.25);border-color:#d9a24f;color:#eed3a5}
.radio{width:22px;height:22px;border-radius:11px;border:1.5px solid #55595e;display:inline-flex;align-items:center;justify-content:center;flex:none}
.radio.on{border-color:#d9a24f}.radio.on span{width:10px;height:10px;border-radius:5px;background:#d9a24f}
/* bars */
.bar{height:6px;border-radius:3px;background:rgba(233,234,236,.1);overflow:hidden}
.bar span{display:block;height:100%;border-radius:3px}
.sk{background:linear-gradient(90deg,rgba(233,234,236,.05),rgba(233,234,236,.11),rgba(233,234,236,.05));border-radius:10px}
/* shell */
.hdr{height:56px;display:flex;align-items:center;gap:6px;padding:0 8px}
.hdr .ttl{flex:1;text-align:center;font-size:16px;font-weight:600}
.tabbar{position:absolute;left:0;right:0;bottom:0;height:80px;padding:0 10px 14px;background:linear-gradient(180deg,rgba(18,19,22,.55),rgba(14,15,17,.94) 40%);backdrop-filter:blur(18px);border-top:1px solid rgba(233,234,236,.07);display:flex;align-items:center;justify-content:space-around}
.tab{width:62px;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:10.5px;color:#90959a}
.tab.on{color:#eed3a5}
.fab{width:54px;height:54px;border-radius:27px;display:flex;align-items:center;justify-content:center;color:#eed3a5;background:linear-gradient(180deg,rgba(60,48,30,.6),rgba(20,18,14,.8));box-shadow:inset 0 1.2px .5px rgba(238,211,165,.5),inset 0 0 0 1px rgba(217,162,79,.55);margin-top:-18px}
.live{height:44px;border-radius:22px;display:flex;align-items:center;gap:10px;padding:0 6px 0 14px}
.dot{width:8px;height:8px;border-radius:4px;flex:none}
.scrim{position:absolute;inset:0;background:rgba(6,6,8,.62)}
.sheet{position:absolute;left:0;right:0;bottom:0;border-radius:26px 26px 0 0;background:linear-gradient(180deg,rgba(40,34,26,.94),rgba(18,17,16,.98));box-shadow:inset 0 1.2px .5px rgba(238,211,165,.45),inset 0 0 0 1px rgba(217,162,79,.22);display:flex;flex-direction:column}
.grab{width:38px;height:5px;border-radius:3px;background:rgba(233,234,236,.35);margin:10px auto 4px}
.dialog{position:absolute;left:24px;right:24px;border-radius:24px;padding:22px;background:linear-gradient(180deg,rgba(40,34,26,.96),rgba(18,17,16,.98));box-shadow:inset 0 1.2px .5px rgba(238,211,165,.45),inset 0 0 0 1px rgba(217,162,79,.22);display:flex;flex-direction:column;gap:12px}
.snack{position:absolute;left:16px;right:16px;height:52px;border-radius:26px;display:flex;align-items:center;gap:10px;padding:0 8px 0 18px;background:linear-gradient(180deg,rgba(50,42,30,.95),rgba(24,22,18,.97));box-shadow:inset 0 1.2px .5px rgba(238,211,165,.45),inset 0 0 0 1px rgba(217,162,79,.26);font-size:14px}
.rail{position:absolute;left:0;top:0;bottom:0;width:76px;background:rgba(16,17,19,.92);border-right:1px solid rgba(233,234,236,.07);display:flex;flex-direction:column;align-items:center;gap:6px;padding:18px 0}
.rail .ri{width:52px;height:52px;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;font-size:9.5px;color:#90959a}
.rail .ri.on{color:#eed3a5;background:rgba(217,162,79,.14);box-shadow:inset 0 0 0 1px rgba(217,162,79,.4)}
.wg{position:relative;overflow:hidden;display:flex;flex-direction:column}
/* ---- emphasis levels: e1 hero · e2 glass · e3 card · e4 quiet ---- */
.t-hero{font-size:56px;font-weight:600;letter-spacing:-.035em;line-height:1}
.t-num{font-size:28px;font-weight:600;letter-spacing:-.02em;line-height:1.05}
.card.hero{background:radial-gradient(120% 90% at 20% 0%,rgba(217,162,79,.20),transparent 60%),linear-gradient(180deg,rgba(66,52,30,.62),rgba(22,19,14,.78));border:0;border-radius:24px;box-shadow:inset 0 1.4px .5px rgba(238,211,165,.62),inset 0 0 0 1px rgba(217,162,79,.5),0 22px 60px -22px rgba(217,162,79,.55),0 10px 30px -12px rgba(0,0,0,.7)}
.card.quiet{background:transparent;border:0;border-radius:0}
.card.quiet.pad{padding:4px 2px}
.well{background:rgba(6,6,8,.5);border-radius:16px;box-shadow:inset 0 1px 0 rgba(0,0,0,.4),inset 0 0 0 1px rgba(233,234,236,.06)}
.wstep{flex:1 1 0;min-width:0;padding:10px 6px 8px;display:flex;flex-direction:column;gap:2px}
.wstep .lab{font-size:10.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#90959a;text-align:center}
.wstep .rw{display:flex;align-items:center;justify-content:space-between}
.wstep .rw button{width:34px;height:44px;display:flex;align-items:center;justify-content:center;color:#b0b4b8;flex:none}
.wstep .v{flex:1;min-width:0;text-align:center;font-size:32px;font-weight:600;letter-spacing:-.03em;font-variant-numeric:tabular-nums;white-space:nowrap}
.card.hero .wstep .v{font-size:36px}
.lhero{position:relative;overflow:hidden;box-shadow:inset 0 -1px 0 #d9a24f}
.lhero .bgp{position:absolute;inset:0;background:repeating-linear-gradient(135deg,rgba(255,255,255,.035) 0 2px,transparent 2px 11px),linear-gradient(90deg,#23262a,#2c2f33)}
.lhero .scr2{position:absolute;inset:0;background:linear-gradient(90deg,rgba(22,23,26,.96) 30%,rgba(22,23,26,.62) 75%,rgba(22,23,26,.4))}
.lhero .bd{position:absolute;inset:0;right:120px;display:flex;flex-direction:column;justify-content:center;gap:3px;padding:0 18px}
.lhero .ac{position:absolute;right:14px;top:0;bottom:0;display:flex;align-items:center;gap:8px}
.card.illness{background:linear-gradient(180deg,rgba(110,70,34,.38),rgba(40,24,12,.6));border:0;box-shadow:inset 0 1.2px .5px rgba(249,215,182,.4),inset 0 0 0 1px rgba(240,163,94,.32)}
.card.injury{background:linear-gradient(180deg,rgba(111,49,41,.38),rgba(40,18,15,.6));border:0;box-shadow:inset 0 1.2px .5px rgba(245,201,194,.4),inset 0 0 0 1px rgba(226,120,106,.34)}
.card.active{background:linear-gradient(180deg,rgba(36,92,78,.38),rgba(10,34,30,.6));border:0;box-shadow:inset 0 1.2px .5px rgba(191,234,219,.4),inset 0 0 0 1px rgba(92,200,168,.3)}
.card.kcal{background:linear-gradient(180deg,rgba(28,58,90,.38),rgba(12,24,38,.6));border:0;box-shadow:inset 0 1.2px .5px rgba(203,224,246,.4),inset 0 0 0 1px rgba(61,132,201,.32)}
.card.sport{background:linear-gradient(180deg,rgba(61,90,42,.36),rgba(20,30,14,.6));border:0;box-shadow:inset 0 1.2px .5px rgba(215,240,193,.38),inset 0 0 0 1px rgba(168,220,124,.3)}
.card.apex{background:linear-gradient(180deg,rgba(74,54,128,.38),rgba(26,18,44,.6));border:0;box-shadow:inset 0 1.2px .5px rgba(217,201,251,.4),inset 0 0 0 1px rgba(157,111,240,.32)}
.card.learn{background:linear-gradient(180deg,rgba(110,42,62,.38),rgba(40,15,24,.6));border:0;box-shadow:inset 0 1.2px .5px rgba(249,196,211,.4),inset 0 0 0 1px rgba(229,83,126,.32)}
.card.atlas{background:linear-gradient(180deg,rgba(107,50,44,.38),rgba(40,20,18,.6));border:0;box-shadow:inset 0 1.2px .5px rgba(243,193,187,.4),inset 0 0 0 1px rgba(208,88,77,.32)}
.c-illness{color:#f9d7b6}.c-injury{color:#f5c9c2}.c-active{color:#bfeadb}.c-kcal{color:#cbe0f6}.c-sport{color:#d7f0c1}.c-apex{color:#d9c9fb}.c-learn{color:#f9c4d3}.c-atlas{color:#f3c1bb}
.pic{display:block;object-fit:cover;background:#1f2125}
.tin{width:78px;height:40px;border-radius:12px;background:rgba(6,6,8,.5);box-shadow:inset 0 0 0 1px rgba(233,234,236,.12);border:0;outline:0;color:#e9eaec;font:600 20px/1 Inter,system-ui,sans-serif;font-variant-numeric:tabular-nums;text-align:center;padding:0}
.tin.focus{box-shadow:inset 0 0 0 1.5px rgba(217,162,79,.8),0 0 0 3px rgba(217,162,79,.14)}
.hl{border-top:1px solid rgba(233,234,236,.08)}
.vl{border-left:1px solid rgba(233,234,236,.08)}
"""

# ---------------------------------------------------------------- icons (24px stroke)
I = {
 'plus': '<path d="M12 5v14M5 12h14"/>', 'minus': '<path d="M5 12h14"/>', 'check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
 'x': '<path d="M6 6l12 12M18 6L6 18"/>', 'back': '<path d="M15 5l-7 7 7 7"/>', 'chev': '<path d="M9 6l6 6-6 6"/>',
 'down': '<path d="M6 9l6 6 6-6"/>', 'up': '<path d="M6 15l6-6 6 6"/>', 'more': '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
 'search': '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>', 'filter': '<path d="M4 6h16M7 12h10M10 18h4"/>',
 'sliders': '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
 'today': '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>',
 'plan': '<path d="M5 6h14M5 12h14M5 18h9"/>', 'progress': '<path d="M4 19l5-6 4 3 7-9"/>',
 'me': '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 5-5 8-5s6.5 1 8 5"/>',
 'dumbbell': '<path d="M3 10v4M6 7v10M18 7v10M21 10v4M6 12h12"/>', 'play': '<path d="M8 5l11 7-11 7z"/>',
 'pause': '<path d="M8 5v14M16 5v14"/>', 'next': '<path d="M6 5l9 7-9 7zM18 5v14"/>', 'prev': '<path d="M18 5l-9 7 9 7zM6 5v14"/>',
 'timer': '<circle cx="12" cy="13" r="7"/><path d="M12 9v4l2.5 2M10 3h4"/>', 'clock': '<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
 'bolt': '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>', 'trophy': '<path d="M8 4h8v5a4 4 0 01-8 0zM8 6H5a3 3 0 003 4M16 6h3a3 3 0 01-3 4M12 13v4M8 20h8"/>',
 'flame': '<path d="M12 21c-4 0-6-3-6-6 0-4 4-6 4-10 3 2 5 5 5 8 1-1 1-2 1-3 2 2 2 4 2 5 0 3-2 6-6 6z"/>',
 'heart': '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z"/>',
 'moon': '<path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/>', 'sun': '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
 'bandage': '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="M11 11h.01M13 13h.01"/>',
 'pulse': '<path d="M3 12h4l2-5 4 10 2-5h6"/>', 'scale': '<path d="M5 4h14l2 16H3zM9 9a3 3 0 016 0"/>',
 'run': '<circle cx="14" cy="4.5" r="1.8"/><path d="M9 21l3-6 3 2v4M6 12l4-4 4 1 2 3 3 1M12 15l-2-4"/>',
 'home': '<path d="M4 11l8-7 8 7v9H4z"/>', 'history': '<path d="M4 12a8 8 0 103-6.2M4 4v4h4M12 8v4l3 2"/>',
 'pin': '<path d="M12 21s-6-5.5-6-11a6 6 0 0112 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
 'building': '<path d="M4 20V6l8-3 8 3v14M9 20v-5h6v5M8 9h1M15 9h1M8 12h1M15 12h1"/>',
 'music': '<path d="M9 18V6l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>',
 'chat': '<path d="M4 5h16v11H9l-5 4z"/>', 'spark': '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
 'bell': '<path d="M6 16V11a6 6 0 0112 0v5l2 2H4zM10 20a2 2 0 004 0"/>', 'gear': '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
 'edit': '<path d="M4 20h4l11-11-4-4L4 16z"/>', 'trash': '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
 'share': '<path d="M12 4v11M7 9l5-5 5 5M5 14v6h14v-6"/>', 'lock': '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
 'eye': '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
 'cloudoff': '<path d="M3 3l18 18M7 18h10a4 4 0 00.8-7.9A6 6 0 008 8"/>', 'wifi': '<path d="M3 9a14 14 0 0118 0M6 12.5a9 9 0 0112 0M9 16a4 4 0 016 0M12 19h.01"/>',
 'camera': '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>', 'image': '<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 16l5-5 4 4 3-3 4 4"/><circle cx="15.5" cy="9.5" r="1.5"/>',
 'link': '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
 'qr': '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2"/>',
 'users': '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c1-4 4-5 7-5s6 1 7 5M16 4a3.5 3.5 0 010 7M18 15c2 .5 3.5 2 4 5"/>',
 'book': '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 5v16"/>', 'video': '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
 'star': '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', 'target': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>',
 'chart': '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', 'grid': '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
 'list': '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', 'swap': '<path d="M7 4L4 7l3 3M4 7h13M17 20l3-3-3-3M20 17H7"/>',
 'weight': '<rect x="3" y="9" width="3" height="6" rx="1"/><rect x="18" y="9" width="3" height="6" rx="1"/><rect x="6" y="6" width="3" height="12" rx="1"/><rect x="15" y="6" width="3" height="12" rx="1"/><path d="M9 12h6"/>',
 'note': '<path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5"/>', 'info': '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
 'warn': '<path d="M12 4l9 16H3zM12 10v4M12 17v.01"/>', 'globe': '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
 'download': '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', 'upload': '<path d="M12 20V9M7 14l5-5 5 5M5 4h14"/>', 'mail': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
 'map': '<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>', 'calendar': '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4M8 14h2M14 14h2M8 17h2"/>',
 'drag': '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/>', 'layers': '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
 'mic': '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>', 'send': '<path d="M4 12l16-8-6 16-3-6z"/>',
 'thumbdown': '<path d="M10 20l1-6H5l2-10h9v10zM16 4h4v10h-4"/>', 'shield': '<path d="M12 3l7 3v6c0 5-3 8-7 9-4-1-7-4-7-9V6z"/>',
 'wave': '<path d="M3 17c2 0 2-2 4.5-2S10 17 12 17s2-2 4.5-2S19 17 21 17"/>', 'bike': '<circle cx="6" cy="16" r="3.5"/><circle cx="18" cy="16" r="3.5"/><path d="M6 16l4-7h5l3 7M10 9l-1-3H7"/>',
 'yoga': '<circle cx="12" cy="5" r="1.8"/><path d="M4 12c3 0 5-2 8-2s5 2 8 2M12 10v5l-4 5M12 15l4 5"/>', 'body': '<circle cx="12" cy="5" r="2"/><path d="M8 21l1-9-4-3M16 21l-1-9 4-3M9 9h6"/>',
 'plates': '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>', 'rotate': '<path d="M20 12a8 8 0 11-3-6.2M20 4v4h-4"/>',
 'external': '<path d="M14 4h6v6M20 4l-9 9M18 14v5H5V6h5"/>', 'logout': '<path d="M10 4H5v16h5M14 8l4 4-4 4M18 12H9"/>',
 'desktop': '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>', 'phone': '<rect x="7" y="3" width="10" height="18" rx="2.5"/><path d="M11 18h2"/>',
}


def ico(name, s=20, c='currentColor', w=1.8, fill=False):
    p = I.get(name, I['info'])
    f = f'fill="{c}" stroke="none"' if fill else f'fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round"'
    return f'<svg width="{s}" height="{s}" viewBox="0 0 24 24" {f}>{p}</svg>'


def esc(s):
    return _html.escape(str(s), quote=False)

# ---------------------------------------------------------------- layout primitives


def st(**kw):
    return '; '.join(f"{k.replace('_', '-')}: {v}" for k, v in kw.items())


def row(*items, gap=10, align='center', justify='flex-start', wrap=False, style=''):
    return f'<div style="display: flex; align-items: {align}; justify-content: {justify}; gap: {gap}px;{" flex-wrap: wrap;" if wrap else ""} {style}">{"".join(items)}</div>'


def col(*items, gap=10, style=''):
    return f'<div style="display: flex; flex-direction: column; gap: {gap}px; {style}">{"".join(items)}</div>'


def grid(*items, cols=2, gap=10, style=''):
    return f'<div style="display: grid; grid-template-columns: repeat({cols}, minmax(0, 1fr)); gap: {gap}px; {style}">{"".join(items)}</div>'


def sp(h=0, w=0):
    return f'<div style="flex: {"1" if not h and not w else "none"}; height: {h}px; width: {w}px"></div>' if (h or w) else '<div style="flex: 1"></div>'


def txt(t, cls='t-b', style=''):
    return f'<div class="{cls}" style="{style}">{t}</div>'


def span(t, cls='', style=''):
    return f'<span class="{cls}" style="{style}">{t}</span>'


def lbl(t, tone=None):
    c = f'color: {TONE[tone][0]}' if tone else ''
    return f'<div class="t-l" style="{c}">{t}</div>'

# ---------------------------------------------------------------- atoms


def tile(icon, tone='neutral', lg=False, s=None):
    g, b, r = TONE[tone]
    return f'<span class="tile{" lg" if lg else ""}" style="background: {b}; box-shadow: inset 0 0 0 1px {r}; color: {g}">{ico(icon, s or (22 if lg else 18))}</span>'


def avatar(ch='M', s=40):
    return f'<span class="av" style="width: {s}px; height: {s}px; font-size: {int(s*0.4)}px">{ch}</span>'


def atlas_face(s=40):
    return f'<span class="atlas" style="width: {s}px; height: {s}px"></span>'


def art(s=44, v=0, r=10):
    grads = ['linear-gradient(135deg,#2b1f3a 0%,#8a642e 55%,#eed3a5 100%)', 'linear-gradient(200deg,#2c1614 0%,#7d302b 55%,#e4bb76 100%)',
             'linear-gradient(160deg,#0e2a3b 0%,#1c6f9a 60%,#93d4f2 100%)', 'linear-gradient(120deg,#1f2f14 0%,#34511f 55%,#a8dc7c 100%)']
    return f'<span class="art" style="width: {s}px; height: {s}px; border-radius: {r}px; background: {grads[v % 4]}"></span>'


def photo(w='100%', h=120, r=14, label=''):
    return f'<div class="house" style="width: {w if isinstance(w, str) else str(w)+"px"}; height: {h}px; border-radius: {r}px; display: flex; align-items: flex-end; padding: 10px; font-size: 11px; color: #71767b">{label}</div>'


def tag(t, tone='brass', icon=None):
    g, b, r = TONE[tone]
    return f'<span class="tag" style="background: {b}; color: {g}; box-shadow: inset 0 0 0 1px {r}">{ico(icon, 12) if icon else ""}{t}</span>'


def dot(tone='brass'):
    return f'<span class="dot" style="background: {ACCENT[tone]}"></span>'


def btn(t, kind='pri', icon=None, sm=False, full=False, dis=False, style=''):
    cls = f'btn {kind}' + (' sm' if sm else '') + (' full' if full else '') + (' dis' if dis else '')
    return f'<button class="{cls}" style="{style}">{ico(icon, 16 if sm else 18) if icon else ""}{t}</button>'


def ibtn(icon, label, kind='', sm=False, style=''):
    return f'<button class="ib {kind}{" sm" if sm else ""}" aria-label="{label}" style="{style}">{ico(icon, 18 if sm else 20)}</button>'


def chip(t, on=False, icon=None):
    return f'<button class="chip{" on" if on else ""}">{ico(icon, 14) if icon else ""}{t}</button>'


def chips(items, on=0, wrap=True):
    return row(*[chip(x, i == on) for i, x in enumerate(items)], gap=8, wrap=wrap)


def seg(items, on=0):
    return '<div class="seg">' + ''.join(f'<button class="{"on" if i == on else ""}">{x}</button>' for i, x in enumerate(items)) + '</div>'


def toggle(on=True):
    return f'<span class="tg{" on" if on else ""}"><span></span></span>'


def check(on=True):
    return f'<span class="chk{" on" if on else ""}">{ico("check", 14) if on else ""}</span>'


def radio(on=True):
    return f'<span class="radio{" on" if on else ""}"><span></span></span>'


def field(label=None, value='', ph='', state='', icon=None, err=None, trail=''):
    v = f'<input value="{esc(value)}" placeholder="{esc(ph)}" aria-label="{esc(label or ph)}">'
    f = f'<div class="field {state}">{ico(icon, 18, "#90959a") if icon else ""}{v}{trail}</div>'
    lb = f'<div class="flabel">{label}</div>' if label else ''
    er = f'<div class="ferr">{err}</div>' if err else ''
    return f'<div>{lb}{f}{er}</div>'


def search(ph='Search', value=''):
    return field(value=value, ph=ph, icon='search')


def stepper(value, unit='', label=None, big=True):
    """App .stepper: a dark well; tiny label on top; − value + with plain glyph buttons at the edges, so the value gets the full width."""
    lab = f'<div class="lab">{label}{(", " + unit) if unit and label else ""}</div>' if label else ''
    fs = '' if big else ' style="font-size: 24px"'
    return (f'<div class="well wstep">{lab}<div class="rw"><button aria-label="Decrease">{ico("minus", 20)}</button>'
            f'<span class="v"{fs}>{value}{"" if label else ("<span class=t-m style=margin-left:4px>" + unit + "</span>" if unit else "")}</span>'
            f'<button aria-label="Increase">{ico("plus", 20)}</button></div></div>')


def bar(pct, tone='brass', h=6):
    return f'<div class="bar" style="height: {h}px"><span style="width: {pct}%; background: {ACCENT[tone]}"></span></div>'


def ring(pct, s=64, tone='brass', w=6, center=''):
    r = (s - w) / 2
    c = 2 * 3.14159 * r
    return (f'<div style="position: relative; width: {s}px; height: {s}px; flex: none"><svg width="{s}" height="{s}" viewBox="0 0 {s} {s}">'
            f'<circle cx="{s/2}" cy="{s/2}" r="{r}" fill="none" stroke="rgba(233,234,236,.1)" stroke-width="{w}"/>'
            f'<circle cx="{s/2}" cy="{s/2}" r="{r}" fill="none" stroke="{ACCENT[tone]}" stroke-width="{w}" stroke-linecap="round" stroke-dasharray="{c*pct/100:.1f} {c:.1f}" transform="rotate(-90 {s/2} {s/2})"/></svg>'
            f'<div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; flex-direction: column">{center}</div></div>')


def spark(vals, w=140, h=44, tone='brass', fill=True):
    mn, mx = min(vals), max(vals)
    pts = [(i * w / (len(vals) - 1), h - 4 - (v - mn) / ((mx - mn) or 1) * (h - 8)) for i, v in enumerate(vals)]
    p = ' '.join(f'{x:.1f},{y:.1f}' for x, y in pts)
    a = ACCENT[tone]
    area = f'<polygon points="0,{h} {p} {w},{h}" fill="{a}" fill-opacity=".12"/>' if fill else ''
    return f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}">{area}<polyline points="{p}" fill="none" stroke="{a}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="{pts[-1][0]:.1f}" cy="{pts[-1][1]:.1f}" r="3" fill="{a}"/></svg>'


def bars(vals, w=280, h=90, tone='brass', hi=None, labels=None):
    n = len(vals); mx = max(vals) or 1; bw = w / n * 0.62; gap = w / n
    out = []
    for i, v in enumerate(vals):
        bh = max(2, v / mx * (h - 18)); x = i * gap + (gap - bw) / 2
        col_ = ACCENT[tone] if (hi is None or i == hi) else 'rgba(233,234,236,.18)'
        out.append(f'<rect x="{x:.1f}" y="{h-16-bh:.1f}" width="{bw:.1f}" height="{bh:.1f}" rx="3" fill="{col_}"/>')
        if labels:
            out.append(f'<text x="{x+bw/2:.1f}" y="{h-3}" font-size="10" fill="#90959a" text-anchor="middle" font-family="Inter">{labels[i]}</text>')
    return f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}">{"".join(out)}</svg>'


def heat(rows_=5, cols_=12, seed=3, tone='brass', cell=14, gap=3):
    a = ACCENT[tone]; out = []
    for r_ in range(rows_):
        for c_ in range(cols_):
            v = ((r_ * 7 + c_ * 13 + seed * 5) % 9)
            op = [0.06, 0.06, .15, .3, .5, .7, .9, .15, .3][v]
            out.append(f'<rect x="{c_*(cell+gap)}" y="{r_*(cell+gap)}" width="{cell}" height="{cell}" rx="3" fill="{a if v>1 else "#e9eaec"}" fill-opacity="{op}"/>')
    return f'<svg width="{cols_*(cell+gap)}" height="{rows_*(cell+gap)}">{"".join(out)}</svg>'


def week(states, today=4, size=None):
    """states: list of 7 of 'done','rest','sick','miss','plan','none','today'"""
    m = {'done': ('rgba(76,190,140,.2)', 'rgba(76,190,140,.5)'), 'rest': ('rgba(51,168,224,.16)', 'rgba(51,168,224,.4)'),
         'sick': ('rgba(226,86,79,.14)', 'rgba(226,86,79,.4)'), 'plan': ('transparent', 'rgba(233,234,236,.25)'),
         'none': ('rgba(233,234,236,.05)', 'rgba(233,234,236,.08)'), 'miss': ('rgba(233,234,236,.05)', 'rgba(233,234,236,.08)')}
    days = 'MTWTFSS'
    cells = []
    for i, s in enumerate(states):
        b, r = m.get(s, m['none'])
        ring_ = ', 0 0 0 2px #d9a24f' if i == today else ''
        dash = 'border: 1px dashed rgba(233,234,236,.3);' if s == 'plan' else ''
        cells.append(f'<div style="display: flex; flex-direction: column; align-items: center; gap: 5px"><div style="width: 100%; aspect-ratio: 1; border-radius: 10px; background: {b}; box-shadow: inset 0 0 0 1px {r}{ring_}; {dash}"></div><span class="t-m" style="{"color: #eed3a5" if i == today else ""}">{days[i]}</span></div>')
    return grid(*cells, cols=7, gap=7)

# ---------------------------------------------------------------- molecules


def card(*inner, tone='', pad=True, style='', gap=10):
    return f'<div class="card {tone}{" pad" if pad else ""}" style="display: flex; flex-direction: column; gap: {gap}px; {style}">{"".join(inner)}</div>'


def section(title, action=None, tone=None):
    a = f'<button class="btn txt" style="height: 32px; font-size: 13px">{action}</button>' if action else ''
    return row(lbl(title, tone), sp(), a, style='min-height: 32px; padding: 0 2px')


def li(title, sub=None, lead=None, trail=None, chev=False, style='', tone=None):
    stl = f' style="color: {TONE[tone][0]}"' if tone else ''
    t = f'<div class="t1"{stl}>{title}</div>' + (f'<div class="t2">{sub}</div>' if sub else '')
    tr = (trail or '') + (ico('chev', 18, '#71767b') if chev else '')
    return f'<div class="li" style="{style}">{lead or ""}<div class="tt">{t}</div><div class="tr">{tr}</div></div>'


def lst(*rows_, tone=''):
    return f'<div class="card {tone}">{"".join(rows_)}</div>'


def stat(label, value, unit='', delta=None, tone='neutral', sub=None, big=False):
    d = f'<span class="t-s" style="color: {ACCENT[tone] if tone != "neutral" else "#b0b4b8"}; margin-left: 6px">{delta}</span>' if delta else ''
    fs = 30 if big else 22
    return col(lbl(label), f'<div class="num" style="font-size: {fs}px; font-weight: 600; letter-spacing: -.02em">{value}<span class="t-m" style="margin-left: 3px">{unit}</span>{d}</div>', txt(sub, 't-m') if sub else '', gap=4)


def stat_card(label, value, unit='', delta=None, tone='neutral', sub=None, glass=False):
    return card(stat(label, value, unit, delta, tone, sub), tone='glass' if glass else '')


def banner(title, sub=None, tone='brass', icon='info', action=None):
    t = 'glass' if tone == 'brass' else tone
    return card(row(tile(icon, tone), col(txt(title, 't-h3'), txt(sub, 't-s') if sub else '', gap=2, style='flex: 1'), btn(action, 'sec', sm=True) if action else '', gap=12), tone=t, style='padding: 12px 14px')


def empty(title, sub, icon='spark', action=None):
    return card(col(tile(icon, 'brass', lg=True), txt(title, 't-h3', 'text-align: center'), txt(sub, 't-s', 'text-align: center; max-width: 280px'), btn(action, 'pri', sm=True) if action else '', gap=10, style='align-items: center; padding: 26px 10px'), tone='dash')


def skel_rows(n=3):
    return lst(*[f'<div class="li"><div class="sk" style="width: 36px; height: 36px; border-radius: 11px"></div><div class="tt"><div class="sk" style="width: {70-i*12}%; height: 12px"></div><div class="sk" style="width: {40+i*8}%; height: 10px; margin-top: 8px"></div></div></div>' for i in range(n)])


def failed(title='Couldn\'t load', sub='Check your connection. Your data is safe on this device.'):
    return card(row(tile('cloudoff', 'bad'), col(txt(title, 't-h3'), txt(sub, 't-s'), gap=2, style='flex: 1'), btn('Retry', 'sec', sm=True), gap=12), tone='bad', style='padding: 12px 14px')


def setrow(n, w, r, state='done', note=None, rpe=None):
    """state: done, next(ghost), pr, fail, warm"""
    num = {'done': '#90959a', 'next': '#eed3a5', 'pr': '#4cbe8c', 'fail': '#f3c2bf', 'warm': '#90959a'}[state]
    body = f'<span class="num" style="flex: 1; font-size: 16px; {"color: #90959a" if state == "next" else ""}">{w} kg × {r}</span>'
    right = {'done': ico('check', 18, '#4cbe8c'), 'pr': tag('PR', 'ok', 'trophy'), 'fail': tag('Failure', 'bad'), 'warm': tag('Warm-up', 'neutral'),
             'next': btn('Log', 'pri', sm=True)}[state]
    extra = (f'<span class="t-m">RPE {rpe}</span>' if rpe else '') + (f'<span class="t-m">{note}</span>' if note else '')
    bg = 'background: rgba(217,162,79,.07);' if state == 'next' else ''
    return f'<div class="li" style="min-height: {58 if state == "next" else 50}px; {bg}"><span class="num" style="width: 22px; font-weight: 600; color: {num}">{n}</span>{body}{extra}{right}</div>'


def exercise_card(name, sets, meta=None, active=True, menu=True):
    head = row(col(txt(name, 't-h3'), txt(meta, 't-m') if meta else '', gap=2, style='flex: 1'), ibtn('more', 'Exercise menu', sm=True) if menu else '', style='padding: 14px 10px 8px 16px')
    return f'<div class="card{" glass" if active else ""}">{head}{"".join(sets)}</div>'


def rest_card(time='1:12', pct=52, nxt='Next: 100 kg × 5'):
    return card(row(ring(pct, 56, 'rest', 5, f'<span class="num" style="font-size: 13px; font-weight: 600">{time}</span>'), col(lbl('Rest', 'rest'), txt(nxt, 't-s'), gap=3, style='flex: 1'), btn('+15 s', 'sec', sm=True), btn('Skip', 'txt', style='height: 36px'), gap=12), tone='rest', style='padding: 12px 14px')


def miniplayer(title='Houdini', artist='Dua Lipa', playing=True):
    return (f'<div class="card glass" style="position: absolute; left: 12px; right: 12px; bottom: 90px; height: 60px; border-radius: 30px; display: flex; align-items: center; gap: 10px; padding: 0 6px 0 8px">'
            f'{art(44, 0, 22)}<div style="flex: 1; min-width: 0"><div style="font-size: 14.5px; font-weight: 600">{title}</div><div class="t-m">{artist}</div></div>'
            f'{ibtn("pause" if playing else "play", "Pause" if playing else "Play")}{ibtn("next", "Next track")}</div>')

# ---------------------------------------------------------------- shell


def header(title='', back=True, action=None, sub=None, large=False, right=''):
    if large:
        return col(row(ibtn('back', 'Back') if back else '', sp(), right, gap=4, style='height: 52px; padding: 0 6px'),
                   f'<div style="padding: 0 16px"><div class="t-h1">{title}</div>{f"<div class=t-s style=margin-top:4px>{sub}</div>" if sub else ""}</div>', gap=2)
    a = action if action else '<span style="width: 44px"></span>'
    return f'<div class="hdr">{ibtn("back", "Back") if back else "<span style=width:44px></span>"}<div class="ttl">{title}{f"<div class=t-m style=font-weight:400>{sub}</div>" if sub else ""}</div>{a}</div>'


def brandbar(right='', app='Gym'):
    """App header (App.tsx .app-brand): spotter · app switcher pill · Mastery badge · Notifications · Language."""
    word = '<span style="font-size: 18px; font-weight: 700; letter-spacing: -.02em">spotter</span>'
    return row(word, chip(app), sp(), right or row(ring(64, 34, 'brass', 3, '<span class="num" style="font-size: 10px; font-weight: 600">640</span>'), ibtn('bell', 'Notifications', 'fill', sm=True), ibtn('globe', 'Language', 'fill', sm=True), gap=6), gap=10, style='height: 56px; padding: 0 12px 0 16px')


def livepill(state='live', label='Chest 2', time='42:18', sub=None):
    tone = {'live': 'brass', 'rest': 'rest', 'offline': 'bad', 'closed': 'neutral'}[state]
    txt_ = {'live': f'Live · {label}', 'rest': f'Resting · {label}', 'offline': f'Live · offline · 3 queued', 'closed': 'Closed automatically'}[state]
    cls = {'live': 'glass', 'rest': 'rest', 'offline': 'bad', 'closed': ''}[state]
    act = btn('Reopen', 'sec', sm=True) if state == 'closed' else f'<span class="num" style="font-size: 16px; font-weight: 600; padding-right: 10px">{time}</span>'
    return f'<div class="card {cls} live">{dot(tone)}<span class="t-l" style="color: {TONE[tone][0]}; flex: 1">{txt_}</span>{act}</div>'


APP_TABS = [('today', 'Today', 'home'), ('overview', 'Overview', 'progress'), None, ('gyms', 'Gyms', 'pin'), ('apps', 'Apps', 'grid')]
_TAB_ALIAS = {'plan': 'overview', 'progress': 'overview', 'me': '', 'programs': 'overview'}


def tabbar(active='today', items=None):
    """App.tsx tab bar: Today · Overview · (+ Start) · Gyms · Apps. Sub-apps pass their own items [(key, label, icon)|None]."""
    active = _TAB_ALIAS.get(active, active)
    out = []
    for t in (items or APP_TABS):
        if t is None:
            out.append('<button class="fab" aria-label="Start">' + ico('plus', 24, w=2) + '</button>')
        else:
            out.append(f'<button class="tab{" on" if t[0] == active else ""}">{ico(t[2], 22)}<span>{t[1]}</span></button>')
    return '<nav class="tabbar">' + ''.join(out) + '</nav>'


def sleephero(paused=False, dur='6 h 48 min', since='23:40'):
    """SleepHero band shown above every screen while a night is live (App.tsx)."""
    lab = 'Paused' if paused else 'Asleep'
    meta = 'not counting' if paused else f'since {since}'
    return (f'<div class="card glass" style="display: flex; align-items: center; gap: 12px; padding: 10px 10px 10px 14px">'
            f'<div style="flex: 1; min-width: 0">{row(dot("brass"), f"<span class=t-l>{lab}</span>", gap=8)}'
            f'<div style="display: flex; align-items: baseline; gap: 8px; margin-top: 4px"><span class="num t-h3" style="white-space: nowrap">{dur}</span><span class="t-m">{meta}</span></div></div>'
            f'{ibtn("moon", "Back to sleep", "pri", sm=True)}{btn("I’m awake — stop", "sec", sm=True)}</div>')


def mood_cls(mood, skin=''):
    """mood 'sky' = Gym app during a live night: moonlit tokens + Spotter Sky.
    mood 'moon' = a sub-app (Apex, People, Learn) during a live night: tokens flip, no sky, no SleepHero.
    skin = sub-app accent: 'apex' (amethyst), 'roster' (People, silver), 'learn' (rubellite), 'nutrition' (lazurite)."""
    sk = f' sk-{skin}' if skin else ''
    if not mood:
        return sk
    if mood == 'sky':
        return ' m-sky nt' + sk
    if mood == 'moon':
        return ' m-moon nt' + sk
    return ' m-' + mood + sk


def phone(*content, tabs='today', h=844, scroll_pad=True, overlay='', top='', mood='', skin=''):
    """tabs=None hides the tab bar. overlay = sheet/dialog/snack markup placed absolutely."""
    padb = 100 if tabs else 24
    inner = f'<div class="body" style="padding-bottom: {padb}px">{"".join(content)}</div>'
    tb = (tabbar(*tabs) if isinstance(tabs, tuple) else tabbar(tabs)) if tabs else ''
    return f'<div class="scr{mood_cls(mood, skin)}" style="width: 390px; height: {h}px">{top}{inner}{tb}{overlay}</div>'


def sheet(title=None, *content, h=560, sub=None, close=True, footer=''):
    hd = row(col(txt(title, 't-h2'), txt(sub, 't-s') if sub else '', gap=2, style='flex: 1'), ibtn('x', 'Close', 'fill', sm=True) if close else '', style='padding: 6px 16px 4px') if title else ''
    ft = f'<div style="padding: 12px 16px 24px">{footer}</div>' if footer else ''
    return f'<div class="scrim"></div><div class="sheet" style="height: {h}px"><div class="grab"></div>{hd}<div style="flex: 1; overflow: hidden; padding: 10px 16px 0; display: flex; flex-direction: column; gap: 12px">{"".join(content)}</div>{ft}</div>'


def dialog(title, body, primary='Delete', secondary='Cancel', kind='dan', top=250):
    return (f'<div class="scrim"></div><div class="dialog" style="top: {top}px">{txt(title, "t-h2")}{txt(body, "t-s", "font-size: 14px")}'
            f'{row(btn(secondary, "sec", full=True), btn(primary, kind, full=True), gap=8)}</div>')


def snack(text, action='Undo', bottom=96):
    return f'<div class="snack" style="bottom: {bottom}px"><span style="flex: 1">{text}</span><button class="btn txt" style="height: 40px">{action}</button></div>'


RAIL_ITEMS = [('today', 'Today', 'home'), ('overview', 'Overview', 'progress'), ('gyms', 'Gyms', 'pin')]


def desktop(content, active='today', w=1440, h=900, right='', mood='', items=None, skin=''):
    """AppRail.tsx: brand mark · nav · (foot) Mastery · Notifications · Apps · profile."""
    active = _TAB_ALIAS.get(active, active)
    ri = lambda k, n, i: f'<button class="ri{" on" if k == active else ""}">{ico(i, 20)}<span>{n}</span></button>'
    rail = ('<div class="rail">' + tile('dumbbell', 'brass', lg=True) + sp(h=10) + ''.join(ri(*x) for x in (items or RAIL_ITEMS)) + '<div style="flex: 1"></div>'
            + ring(64, 34, 'brass', 3, '<span class="num" style="font-size: 10px; font-weight: 600">640</span>') + ri('bell', 'Alerts', 'bell') + ri('apps', 'Apps', 'grid') + avatar('M', 36) + '</div>')
    return f'<div class="scr{mood_cls(mood, skin)}" style="width: {w}px; height: {h}px">{rail}<div style="position: absolute; left: 76px; right: 0; top: 0; bottom: 0; padding: 28px 40px; display: flex; flex-direction: column; gap: 18px">{content}</div>{right}</div>'


def setentry(title='Enter this set', reps='5', weight='100', unit='kg', note=None, worth=None, pr=None, fail=None, drops=None, log='Log', kicker=None):
    """GhostSetRow — THE focal block of a live session (emphasis e1). Full-width wells, big numbers, one big Log.
    drops = [(reps, weight), ...] renders the drop-set parts (Start, Drop 1, Drop 2…)."""
    head = row(txt(title, 't-l c-brass'), sp(), txt(kicker, 't-m') if kicker else '', style='padding: 0 2px')
    if drops:
        parts = [col(txt('Start', 't-m'), grid(stepper(reps, '', 'Reps'), stepper(weight, '', f'Weight, {unit}'), cols=2, gap=8), gap=6)]
        for i, (r, w) in enumerate(drops):
            parts.append(col(txt(f'Drop {i + 1}', 't-m'), grid(stepper(r, '', 'Reps'), stepper(w, '', f'Weight, {unit}'), cols=2, gap=8), gap=6))
        body = col(*parts, gap=10)
    else:
        body = grid(stepper(reps, '', 'Reps'), stepper(weight, '', f'Weight, {unit}'), cols=2, gap=10)
    extra = ''
    if note: extra += txt(note, 't-s')
    if worth is not None:
        extra += col(row(txt('Worth another set', 't-s'), sp(), txt(f'{worth} %', 't-s num'), style=''), bar(worth, 'neutral'), gap=6)
    if pr: extra += banner(pr, None, 'ok', 'trophy')
    if fail: extra += txt(fail, 't-s c-bad')
    acts = row(ibtn('sliders', 'Set options', 'fill'), ibtn('flame', 'To failure', 'fill'), btn(log, 'pri', full=True, style='flex: 1; height: 54px; font-size: 17px'), gap=10)
    return card(head, body, extra, acts, tone='hero', gap=14, style='padding: 16px')


def livehero(kind='session', label='In session · Iron Temple', timer='42:18', meta='12 sets · 5.8 t', action=None, state='live', photo=True):
    """App LiveHero. kind 'compact'/'session' = 72 px slim bar (timer 20 px); 'today' = 148 px (timer 40 px). Full-bleed, brass hairline at the bottom."""
    h = 148 if kind == 'today' else 72
    tfs = 40 if kind == 'today' else 20
    tone = {'live': 'brass', 'offline': 'bad', 'closed': 'neutral', 'rest': 'rest'}[state]
    line = {'live': '#d9a24f', 'offline': '#e2564f', 'closed': '#55595e', 'rest': '#33a8e0'}[state]
    act = action if action is not None else (btn('Resume', 'sec', sm=True) if kind != 'session' else '')
    return (f'<div class="lhero" style="height: {h}px; box-shadow: inset 0 -1px 0 {line}">{"<div class=bgp></div>" if photo else ""}<div class="scr2"></div>'
            f'<div class="bd">{row(dot(tone), f"<span class=t-l style=font-size:10px>{label}</span>", gap=8)}'
            f'<div style="display: flex; align-items: baseline; gap: 10px"><span class="num" style="font-size: {tfs}px; font-weight: 600; letter-spacing: -.01em">{timer}</span><span class="t-m num">{meta}</span></div></div>'
            f'<div class="ac">{act}</div></div>')


PLATE = {25: ('#c8453d', 96), 20: ('#3d6fc9', 92), 15: ('#d9b53d', 84), 10: ('#3f9a5c', 74), 5: ('#e9eaec', 58), 2.5: ('#2a2c30', 46), 1.25: ('#b0b4b8', 38)}


def barbell(per_side=(25, 15), bar=20, w=358, h=132, collar=True):
    """Plate calculator drawing: a real barbell — long shaft, inner stops, sleeves, colour-coded plates (IWF colours)
    pushed against the stops, collars outside the plates."""
    cy = h / 2; out = []; sl = 92
    out.append(f'<rect x="{sl}" y="{cy-3}" width="{w-2*sl}" height="6" rx="3" fill="#8f959b"/>')  # shaft
    out.append(f'<rect x="{w/2-40}" y="{cy-3}" width="80" height="6" fill="url(#kn)"/>')
    for side in (0, 1):
        s0 = 4 if side == 0 else w - 4 - sl
        out.append(f'<rect x="{s0}" y="{cy-7}" width="{sl}" height="14" rx="4" fill="#c3c7cf"/>')  # sleeve
        stop = (s0 + sl - 6) if side == 0 else s0
        out.append(f'<rect x="{stop}" y="{cy-16}" width="6" height="32" rx="2" fill="#7b8088"/>')
        x = stop if side == 0 else stop + 6
        for kg in per_side:
            c_, ph = PLATE[kg]; ph = ph * 1.12; pw = 15 if kg >= 10 else 10
            if side == 0: x -= pw + 1.5
            out.append(f'<rect x="{x:.1f}" y="{cy-ph/2:.1f}" width="{pw}" height="{ph:.1f}" rx="3" fill="{c_}" stroke="rgba(0,0,0,.4)"/>')
            if side == 1: x += pw + 1.5
        if collar:
            cx = (x - 7) if side == 0 else x
            out.append(f'<rect x="{cx:.1f}" y="{cy-11}" width="6" height="22" rx="2" fill="#d9a24f"/>')
    defs = '<defs><pattern id="kn" width="3" height="3" patternUnits="userSpaceOnUse"><path d="M0 3L3 0" stroke="#6b7076" stroke-width=".8"/></pattern></defs>'
    return f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" aria-label="Barbell">{defs}{"".join(out)}</svg>'


def plates_legend(per_side=(25, 15)):
    return row(*[tag(f'{k} kg', 'neutral') for k in per_side], gap=6)



# ---------------------------------------------------------------- real app imagery & anatomy
_ASSET_DIR = os.path.join(OUT, 'assets')


def img(key, w='100%', h=120, r=14, fit='cover', alt='', pos='center', style=''):
    """A REAL image from the app's public/ folder (see ASSETS.txt), e.g. img('exercise-img/Barbell_Full_Squat/0.jpg', 160, 120).
    Use it wherever the app shows a picture (exercise photos, equipment, Atlas portraits, physiques, markers, home hero)."""
    if not os.path.exists(os.path.join(_ASSET_DIR, key)):
        raise FileNotFoundError(f'asset not staged: {key} (see ASSETS.txt)')
    ws = w if isinstance(w, str) else f'{w}px'
    hs = h if isinstance(h, str) else f'{h}px'
    return f'<img class="pic" src="assets/{key}" alt="{esc(alt)}" style="width: {ws}; height: {hs}; border-radius: {r}px; object-fit: {fit}; object-position: {pos}; {style}">'


_RICH = None


def exercise_img(name, i=0):
    """Asset key of the app's photo for an exercise name (data/exercises.rich.json + legacy aliases)."""
    global _RICH
    if _RICH is None:
        p = '/mnt/user-data/uploads/training/gym-tracker/client/src/data/exercises.rich.json'
        _RICH = {e['name'].lower(): e for e in json.load(open(p))}
    alias = {'bench press': 'barbell bench press - medium grip', 'back squat': 'barbell full squat', 'squat': 'barbell full squat',
             'deadlift': 'barbell deadlift', 'overhead press': 'standing military press', 'lat pulldown': 'wide-grip lat pulldown',
             'barbell row': 'bent over barbell row', 'lateral raise': 'side lateral raise', 'biceps curl': 'barbell curl'}
    e = _RICH.get(alias.get(name.lower(), name.lower()))
    if not e or not e.get('images'):
        return None
    k = e['images'][min(i, len(e['images']) - 1)].lstrip('/')
    return k if os.path.exists(os.path.join(_ASSET_DIR, k)) else None


def exercise_pic(name, w=64, h=64, r=12, i=0):
    """Exercise thumbnail exactly as the app shows it; falls back to the app's dumbbell tile when no photo exists."""
    k = exercise_img(name, i)
    return img(k, w, h, r, alt=name) if k else tile('dumbbell', 'neutral', lg=True)


_BM = json.load(open(os.path.join(ROOT, 'bodymuscles.json')))
_MM = json.load(open(os.path.join(ROOT, 'musclemap.json')))
_VIEW = {'front': [(m['id'], m['path']) for m in _BM['front']], 'back': [(m['id'], m['path']) for m in _BM['back']]}


def bodymap(view='front', primary=(), secondary=(), paint=None, region='full', w=None, h=None, hl='#d9a24f', full=False):
    """The app's anatomical figure (components/Muscle.tsx, body-muscles paths). primary groups in brass, secondary grey,
    rest dimmed. paint={group: colour-or-tone} for heatmaps (zones: under/productive/high/over; focus grow/ease).
    region: full|upper|lower|arms|torso (auto-crop like the app). Groups: chest, back, lats, traps, lower_back, shoulders,
    biceps, triceps, forearms, core, quads, adductors, hamstrings, glutes, abductors, calves, neck."""
    lib = _MM['LIB']; vb = _MM['VIEWBOX'][view][region]
    ids = None if region == 'full' else set(_MM['REGION_IDS'][view][region] or [])
    col_of = {}
    for g in secondary:
        for i in lib.get(g, {}).get(view, []): col_of[i] = '#90959a'
    for g in primary:
        for i in lib.get(g, {}).get(view, []): col_of[i] = hl
    for g, c in (paint or {}).items():
        c = ACCENT.get(c, c)
        for i in lib.get(g, {}).get(view, []): col_of[i] = c
    out = []
    for pid, d in _VIEW[view]:
        if ids is not None and pid not in ids: continue
        c = hl if full else col_of.get(pid)
        out.append(f'<path d="{d}" fill="{c or "#3b3f43"}" stroke="{"#16171a" if c else "#262a2d"}" stroke-width="{0.25 if c else 0.12}"/>')
    size = (f'width="{w}" ' if w else '') + (f'height="{h}"' if h else '')
    return f'<svg viewBox="{vb}" {size} style="display: block">{"".join(out)}</svg>'


def bodypair(primary=(), secondary=(), paint=None, h=220, gap=8, labels=False):
    """Front + back figures side by side (exercise detail, muscle map, heatmaps)."""
    f = bodymap('front', primary, secondary, paint, h=h); b = bodymap('back', primary, secondary, paint, h=h)
    if labels:
        f = col(f, txt('Front', 't-m', 'text-align: center'), gap=4); b = col(b, txt('Back', 't-m', 'text-align: center'), gap=4)
    return row(f, b, gap=gap, justify='center', align='flex-start')


def swatch(hex_, s=14, r=4):
    """An app DATA colour (band colours, IWF plates, calendar/zone ramps) copied from the app's data/CSS — allowed only for data."""
    return f'<span style="display: inline-block; width: {s}px; height: {s}px; border-radius: {r}px; background: {hex_}; box-shadow: inset 0 0 0 1px rgba(0,0,0,.3)"></span>'



def gauge(level=2, levels=('Light', 'Moderate', 'Hard'), tones=('ok', 'brass', 'danger'), w=220, label=None):
    """EffortGauge: a semicircle dial split into coloured segments with a needle on the chosen level (1-based)."""
    import math
    cx, cy, r = w / 2, w / 2, w / 2 - 14
    n = len(levels); out = []
    for i in range(n):
        a0 = math.pi + math.pi * i / n + 0.03; a1 = math.pi + math.pi * (i + 1) / n - 0.03
        x0, y0 = cx + r * math.cos(a0), cy + r * math.sin(a0); x1, y1 = cx + r * math.cos(a1), cy + r * math.sin(a1)
        op = 1 if i + 1 == level else .28
        out.append(f'<path d="M{x0:.1f} {y0:.1f} A{r} {r} 0 0 1 {x1:.1f} {y1:.1f}" stroke="{ACCENT[tones[i]]}" stroke-opacity="{op}" stroke-width="14" fill="none" stroke-linecap="round"/>')
    a = math.pi + math.pi * (level - .5) / n
    out.append(f'<line x1="{cx}" y1="{cy}" x2="{cx + (r - 26) * math.cos(a):.1f}" y2="{cy + (r - 26) * math.sin(a):.1f}" stroke="#e9eaec" stroke-width="3" stroke-linecap="round"/><circle cx="{cx}" cy="{cy}" r="6" fill="#e9eaec"/>')
    svg = f'<svg width="{w}" height="{w/2 + 10}" viewBox="0 0 {w} {w/2 + 10}">{"".join(out)}</svg>'
    return col(svg, txt(label or levels[level - 1], 't-h2', f'color: {TONE[tones[level-1]][0]}; text-align: center'), gap=0, style='align-items: center')


def timein(value='00:00', focus=False, label='Time'):
    """An editable time field: the user can tap it and TYPE the time (owner: 'must be editable by just typing')."""
    return f'<input class="tin{" focus" if focus else ""}" value="{value}" inputmode="numeric" aria-label="{label}">'


def timerange(start='00:00', end='12:00', dur='12h', a=0, b=50, tone='brass', ticks=('00:00', '06:00', '12:00', '18:00', '00:00'), focus=None, w=318):
    """TimelineRange: typed start/end fields + a draggable range on a 24 h track. a, b = handle positions in %.
    focus='start'|'end' shows the field being typed into."""
    c = ACCENT.get(tone, tone)
    head = row(timein(start, focus == 'start', 'Start'), f'<span class="t-s">→</span>', timein(end, focus == 'end', 'End'), sp(), txt(dur, 't-s'), gap=8)
    track = (f'<div style="position: relative; height: 28px; margin: 4px 6px 0">'
             f'<div style="position: absolute; left: 0; right: 0; top: 11px; height: 6px; border-radius: 3px; background: rgba(233,234,236,.1)"></div>'
             + ''.join(f'<div style="position: absolute; left: {x}%; width: {y - x}%; top: 11px; height: 6px; border-radius: 3px; background: {c}"></div>' for x, y in (((a, b),) if a <= b else ((a, 100), (0, b))))
             + ''.join(f'<span style="position: absolute; left: calc({p}% - 13px); top: 1px; width: 26px; height: 26px; border-radius: 13px; background: rgba(60,48,30,.7); box-shadow: inset 0 0 0 1.5px {c}, 0 2px 8px rgba(0,0,0,.5)"></span>' for p in (a, b))
             + '</div>')
    lab = row(*[txt(t, 't-m num') for t in ticks], justify='space-between', style='padding: 0 2px')
    return card(head, track, lab, gap=8, style=f'width: {w}px')

# ---------------------------------------------------------------- widgets (Today)
WSIZE = {'S': (171, 150), 'M': (358, 64), 'L': (358, 150), 'XL': (358, 330)}


def widget(size, label, body, tone='', icon=None):
    w, h = WSIZE[size]
    if size == 'M':
        return f'<div class="card {tone} wg" style="width: {w}px; height: {h}px; flex-direction: row; align-items: center; gap: 12px; padding: 0 14px">{tile(icon or "spark", "neutral") if icon else ""}{body}</div>'
    return f'<div class="card {tone} wg" style="width: {w}px; height: {h}px; padding: 14px; gap: 8px">{lbl(label)}{body}</div>'


def shortcut(label, icon, tone='neutral', state='default'):
    extra = ''
    cls = ''
    if state == 'live':
        cls = 'glass'; extra = f'<span style="position: absolute; top: 8px; right: 8px">{dot("brass")}</span>'
    if state == 'done':
        extra = f'<span style="position: absolute; top: 6px; right: 6px; color: #4cbe8c">{ico("check", 14, "#4cbe8c", 2.2)}</span>'
    if state == 'selected':
        cls = 'glass'
    return f'<button class="card {cls}" style="position: relative; width: 84px; height: 86px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 7px; font-size: 11.5px; font-weight: 600; color: #d0d3d6; padding: 0 4px; text-align: center">{tile(icon, tone)}{label}{extra}</button>'


# ---------------------------------------------------------------- night mode (live night · styles.css :root[data-sleep='night'])
NIGHT_MAP = [  # brass → moon, warm greys → moonlit navy (token flip)
    ('#eed3a5', '#c3cef4'), ('#e4bb76', '#c3cef4'), ('#d9a24f', '#9fb2e6'), ('#8a642e', '#505d97'), ('#342713', '#1a2140'),
    ('rgba(217,162,79,', 'rgba(159,178,230,'), ('rgba(238,211,165,', 'rgba(195,206,244,'), ('rgba(138,100,46,', 'rgba(80,93,151,'),
    ('rgba(60,48,30,', 'rgba(38,48,92,'), ('rgba(20,18,14,', 'rgba(12,15,30,'), ('rgba(40,34,26,', 'rgba(22,28,52,'), ('rgba(18,17,16,', 'rgba(10,13,26,'),
    ('rgba(50,42,30,', 'rgba(28,36,66,'), ('rgba(24,22,18,', 'rgba(14,18,36,'), ('rgba(52,39,19,', 'rgba(26,33,64,'),
    ('rgba(31,33,37,.72)', 'rgba(20,26,46,.72)'), ('rgba(233,234,236,', 'rgba(159,178,230,'), ('rgba(10,10,12,', 'rgba(6,8,18,'),
    ('rgba(18,19,22,', 'rgba(10,13,24,'), ('rgba(14,15,17,', 'rgba(8,10,20,'), ('rgba(16,17,19,', 'rgba(10,13,24,'),
    ('#e9eaec', '#eff2fc'), ('#d0d3d6', '#dfe4f5'), ('#b0b4b8', '#9aa2bf'), ('#90959a', '#7b83a3'), ('#71767b', '#5f668a'), ('#55595e', '#333c68'),
    ('#121316', '#0a0d18'), ('#0f1012', '#0a0d18'), ('#23262a', '#1c233d'), ('#1a1c20', '#141a2e'),
]


def _sky_svg(w=390, h=900, seed=7):
    """Spotter Sky: dense faint stars on a tilted band + sparse field + a few bright ones (SpotterSky.tsx)."""
    import math
    st = seed
    def rnd():
        nonlocal st
        st = (st * 1664525 + 1013904223) % 4294967296
        return st / 4294967296
    hues = ['#ffffff', '#f2f6ff', '#fff4e6', '#dbe6ff', '#ffe6cc', '#cdd8ff']
    out = []
    ang = math.radians(-28)
    for i in range(520):  # band
        t = rnd() * 1.4 - 0.2; off = (rnd() + rnd() + rnd() - 1.5) * 0.16
        x = (t * w * 1.3) - w * 0.15; y = h * 0.42 + (x - w / 2) * math.tan(ang) + off * h
        out.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{0.35 + rnd() * 0.5:.2f}" fill="{hues[int(rnd() * 6)]}" opacity="{0.25 + rnd() * 0.45:.2f}"/>')
    for i in range(160):  # field
        out.append(f'<circle cx="{rnd() * w:.0f}" cy="{rnd() * h:.0f}" r="{0.4 + rnd() * 0.5:.2f}" fill="#eaf0ff" opacity="{0.2 + rnd() * 0.5:.2f}"/>')
    for i in range(14):  # bright
        out.append(f'<circle cx="{rnd() * w:.0f}" cy="{rnd() * h:.0f}" r="{1 + rnd() * 0.6:.2f}" fill="#ffffff" opacity="{0.7 + rnd() * 0.3:.2f}"/>')
    svg = f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{"".join(out)}</svg>'
    import urllib.parse
    return 'data:image/svg+xml,' + urllib.parse.quote(svg)


def SKY_CSS():
    return ('.m-sky{background:url("' + _sky_svg() + '") 0 0/390px 900px repeat,'
            'linear-gradient(152deg,transparent 30%,rgba(120,140,210,.10) 44%,rgba(255,236,214,.07) 50%,rgba(120,140,210,.08) 56%,transparent 70%),'
            'radial-gradient(40% 18% at 62% 44%,rgba(195,206,244,.10),transparent 70%),'
            'radial-gradient(90% 50% at 20% 0%,rgba(38,48,92,.55),transparent 70%),#0a0d18}')


def nightify(s):
    for a, b in NIGHT_MAP:
        s = s.replace(a, b)
    return s


# ---------------------------------------------------------------- sub-app skins (styles.css .app-apex / .app-roster / .app-learn / .app-nutrition)
# Every sub-app re-skins by swapping the accent ramp; graphite neutrals stay. Gym = brass (default).
SKINS = {  # name: (500, 200, 300, 700, 900)
    'apex': ('#9d6ff0', '#c4a4f7', '#b98ee6', '#6b4bb0', '#241a3a'),      # amethyst
    'roster': ('#c3c7cf', '#d7dae0', '#c3c7cf', '#6f727a', '#26282c'),    # silver (People)
    'learn': ('#e5537e', '#f7c0d1', '#f58fac', '#a12f52', '#3a1420'),     # rubellite
    'nutrition': ('#3d84c9', '#cbe0f6', '#93bde6', '#285a8c', '#12243a'), # lazurite
}


def _rgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def skin_map(name):
    a5, a2, a3, a7, a9 = SKINS[name]
    r5, r2, r7, r9 = _rgb(a5), _rgb(a2), _rgb(a7), _rgb(a9)
    rg = lambda t: 'rgba(%d,%d,%d,' % t
    mix = lambda t, k: tuple(int(c * k) for c in t)
    return [('#eed3a5', a2), ('#e4bb76', a3), ('#d9a24f', a5), ('#8a642e', a7), ('#342713', a9),
            ('rgba(217,162,79,', rg(r5)), ('rgba(238,211,165,', rg(r2)), ('rgba(138,100,46,', rg(r7)),
            ('rgba(60,48,30,', rg(mix(r7, .55))), ('rgba(20,18,14,', rg(mix(r9, .6))), ('rgba(40,34,26,', rg(mix(r9, 1.0))),
            ('rgba(18,17,16,', rg(mix(r9, .55))), ('rgba(50,42,30,', rg(mix(r7, .45))), ('rgba(24,22,18,', rg(mix(r9, .7))),
            ('rgba(52,39,19,', rg(mix(r9, 1.1)))]


def reskin(s, name):
    for a, b in skin_map(name):
        s = s.replace(a, b)
    return s

# ---------------------------------------------------------------- writing
_manifest = {}


def board(file, title, w, h, content, prefix=None, row_=0):
    prefix = prefix or file.split('-')[0]
    import re as _re
    css = CSS
    m = _re.search(r' sk-(apex|roster|learn|nutrition)\b', content)
    if m:  # sub-app skin: swap the accent ramp (before night, so a sub-app keeps its gem at night)
        css = reskin(css, m.group(1)); content = reskin(content, m.group(1))
    if ' nt' in content and (' m-sky nt' in content or ' m-moon nt' in content):  # live night: flip every token
        css = nightify(css) + (SKY_CSS() if ' m-sky nt' in content else '') + '.m-moon{background:radial-gradient(90% 50% at 20% 0%,rgba(38,48,92,.55),transparent 70%),#0a0d18}'
        content = nightify(content)
    doc = f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{esc(title)}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&amp;display=swap" rel="stylesheet">
<style>{css}</style>
</helmet>
<div style="width: {w}px; height: {h}px; position: relative; overflow: hidden; background: {'#0a0d18' if ' nt' in content and 'm-' in content and ('m-sky' in content or 'm-moon' in content) else '#121316'}">
{content}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{w},"height":{h}}}}}'>
class Component extends DCLogic {{
renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
'''
    with open(os.path.join(OUT, file), 'w') as f:
        f.write(doc)
    _manifest.setdefault(prefix, [])
    _manifest[prefix] = [m for m in _manifest[prefix] if m['file'] != file] + [dict(file=file, w=w, h=h, title=title, row=row_)]
    with open(os.path.join(MAN, prefix + '.json'), 'w') as f:
        json.dump(_manifest[prefix], f, ensure_ascii=False, indent=1)


def P(file, title, content, row_=0, h=844):
    """phone board helper: content must be the full phone() markup"""
    board(file, title, 390, h, content, row_=row_)


def spec(title, *blocks, w=1600, h=1000):
    """a states/spec board: title + wrapped blocks with captions"""
    return f'<div class="scr" style="width: {w}px; height: {h}px; padding: 40px 48px; display: flex; flex-direction: column; gap: 26px"><div class="t-h1">{title}</div><div style="display: flex; flex-wrap: wrap; gap: 30px 36px; align-items: flex-start">{"".join(blocks)}</div></div>'


def cap(caption, *inner, w=None):
    ws = f'width: {w}px;' if w else ''
    return f'<div style="display: flex; flex-direction: column; gap: 10px; {ws}"><div class="t-l" style="color: #d9a24f">{caption}</div>{"".join(inner)}</div>'
