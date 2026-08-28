from pathlib import Path

css_path = Path('app/rpg/RPGMode.module.css')
css = css_path.read_text()
replacements = {
'.controls{min-height:112px;display:flex;align-items:center;justify-content:space-between;padding:42px 22px 8px;border:2px solid color-mix(in srgb,var(--accent2) 72%,#09080d);border-top-color:var(--accent2);overflow:hidden;box-shadow:inset 0 0 0 2px #060609,inset 0 18px 34px rgba(255,255,255,.015);background:radial-gradient(ellipse at 50% 36%,color-mix(in srgb,var(--accent2) 18%,transparent) 0 9%,transparent 10% 100%),repeating-linear-gradient(90deg,#0d0c13 0 14px,#09090f 14px 28px)}':
'.controls{min-height:112px;display:flex;align-items:center;justify-content:space-between;padding:46px 20px 9px;border:2px solid color-mix(in srgb,var(--accent2) 72%,#09080d);border-top-color:var(--accent2);overflow:hidden;box-shadow:inset 0 0 0 2px #060609,inset 0 22px 0 rgba(255,255,255,.012),inset 0 -10px 24px rgba(0,0,0,.18);background:linear-gradient(180deg,rgba(255,255,255,.025),transparent 34px),repeating-linear-gradient(0deg,#0d0c13 0 13px,#09090f 13px 26px)}',
'.controls::before{content:"◆  PRISM LINK  ◆";position:absolute;z-index:0;left:50%;top:12px;transform:translateX(-50%);min-width:132px;padding:5px 12px;border:1px solid color-mix(in srgb,var(--accent) 54%,#332b39);background:#090910;color:color-mix(in srgb,var(--accent) 82%,#fff);box-shadow:0 0 0 2px #050507;font:900 6px/1 monospace;letter-spacing:.16em;text-align:center;white-space:nowrap}':
'.controls::before{content:"FIELD CONTROL";position:absolute;z-index:2;left:50%;top:11px;transform:translateX(-50%);min-width:126px;padding:5px 12px;border:1px solid color-mix(in srgb,var(--accent) 54%,#332b39);background:#090910;color:color-mix(in srgb,var(--accent) 88%,#fff);box-shadow:0 0 0 2px #050507;font:900 6px/1 monospace;letter-spacing:.18em;text-align:center;white-space:nowrap}',
'.controls::after{content:"";position:absolute;left:18px;right:18px;top:31px;height:1px;background:linear-gradient(90deg,transparent,var(--accent2) 18% 42%,transparent 42% 58%,var(--accent2) 58% 82%,transparent);opacity:.66}':
'.controls::after{content:"";position:absolute;z-index:0;left:50%;top:57%;width:32px;height:32px;transform:translate(-50%,-50%) rotate(45deg);border:2px solid color-mix(in srgb,var(--accent) 62%,#393443);background:linear-gradient(135deg,color-mix(in srgb,var(--accent2) 28%,#101019),#08080d);box-shadow:0 0 0 3px #050507,inset 0 0 0 3px #0a0910,4px 4px 0 rgba(0,0,0,.34)}',
'.dpad,.abButtons{position:relative;z-index:1}':
'.dpad,.abButtons{position:relative;z-index:1}.dpad::before,.abButtons::before{position:absolute;top:-25px;color:color-mix(in srgb,var(--accent) 72%,#b9b4c0);font:900 6px/1 monospace;letter-spacing:.15em;text-shadow:1px 1px #000;white-space:nowrap}.dpad::before{content:"MOVE";left:50%;transform:translateX(-50%)}.abButtons::before{content:"ACTION";left:50%;transform:translateX(-50%) rotate(8deg)}',
'@media(max-height:720px){.hud{min-height:36px}.locationBar{min-height:23px}.controls{min-height:108px;padding:40px 22px 7px}.controls::before{top:10px}.controls::after{top:29px}.dpad{width:108px;height:108px;grid-template-columns:repeat(3,36px);grid-template-rows:repeat(3,36px)}':
'@media(max-height:720px){.hud{min-height:36px}.locationBar{min-height:23px}.controls{min-height:108px;padding:44px 20px 7px}.controls::before{top:10px}.controls::after{top:58%;width:28px;height:28px}.dpad::before,.abButtons::before{top:-23px}.dpad{width:108px;height:108px;grid-template-columns:repeat(3,36px);grid-template-rows:repeat(3,36px)}'
}
for old, new in replacements.items():
    if old not in css:
        raise SystemExit(f'CSS target not found: {old[:70]}')
    css = css.replace(old, new, 1)
css_path.write_text(css)

progress = Path('PROGRESS.md')
p = progress.read_text()
section = '''\n\n## SFC Visual Reconstruction Pass 12 — Touch control deck\n- Removed the soft central radial glow from the touch deck and replaced it with a crisp region-tinted prism core.\n- Renamed the decorative header to FIELD CONTROL and added MOVE / ACTION labels to make the large portrait control area visually intentional.\n- Preserved D-pad/A/B hit areas, button sizes, Pointer Events and gameplay input behavior.\n'''
if '## SFC Visual Reconstruction Pass 12' not in p:
    progress.write_text(p.rstrip() + section)
