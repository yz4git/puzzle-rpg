from pathlib import Path

p = Path('app/PuzzleRPGGame.tsx')
s = p.read_text()

def rep(old, new, count=1):
    global s
    found = s.count(old)
    if found < count:
        raise SystemExit(f'missing pattern ({found}): {old[:120]!r}')
    s = s.replace(old, new, count)

# Cascades may still be exciting, but accidental resource matches must not make
# an attack turn simultaneously the best attack, heal and defense choice.
rep('''    weightedAttack += frameAttack * cascadeWeight;\n    heal += frameHeal;\n    shield += frameShield;''', '''    weightedAttack += frameAttack * cascadeWeight;\n    const resourceCascadeWeight = safety === 0 ? 1 : safety === 1 ? 0.55 : 0.35;\n    heal += frameHeal * resourceCascadeWeight;\n    shield += frameShield * resourceCascadeWeight;''')
rep('''  const comboMultiplier = 1 + Math.min(0.18, Math.max(0, combo - 1) * 0.09);\n  const resourceMultiplier = 1 + Math.min(0.1, Math.max(0, combo - 1) * 0.05);\n\n  return {\n    frames,\n    finalBoard: next,\n    finalQueues: refillColumnQueues(queues),\n    combo,\n    attack: Math.floor(weightedAttack * comboMultiplier),\n    heal: Math.floor(heal * resourceMultiplier),\n    shield: Math.floor(shield * resourceMultiplier),''', '''  const comboMultiplier = 1 + Math.min(0.18, Math.max(0, combo - 1) * 0.09);\n  const resourceMultiplier = 1 + Math.min(0.1, Math.max(0, combo - 1) * 0.05);\n  // A damaging turn only receives a fraction of incidental HEART/DEF cascades.\n  // A dedicated non-damaging resource turn gets a small tactical bonus instead.\n  const resourceCommitment = weightedAttack > 0 ? 0.35 : 1.15;\n\n  return {\n    frames,\n    finalBoard: next,\n    finalQueues: refillColumnQueues(queues),\n    combo,\n    attack: Math.floor(weightedAttack * comboMultiplier),\n    heal: Math.floor(heal * resourceMultiplier * resourceCommitment),\n    shield: Math.floor(shield * resourceMultiplier * resourceCommitment),''')

# PRISM also rewards tactical turns more than pure offense.
rep('''    const skillGain = isSetupTurn\n      ? 24\n      : Math.min(16, plan.matchedCount * 2 + Math.max(0, plan.combo - 1) * 3);''', '''    const resourceTurn = plan.attack === 0 && plan.frames.length > 0;\n    const skillGain = isSetupTurn\n      ? 24\n      : resourceTurn\n        ? Math.min(18, plan.matchedCount * 2 + Math.max(0, plan.combo - 1) * 3)\n        : Math.min(12, plan.matchedCount + Math.max(0, plan.combo - 1) * 2);''')

# Make the compact footer explain the new opportunity cost.
rep('`消せる手 ${analysis.immediateMoves} • ⬢=DEF • 長期戦は敵威力↑`', '`消せる手 ${analysis.immediateMoves} • 攻撃中の♥/DEF効果↓ • 長期戦は敵威力↑`')

p.write_text(s)

cssp = Path('app/PuzzleRPGGame.module.css')
css = cssp.read_text()
extra = r'''

/* TACTICAL_BALANCE_V3_VISUAL — remove remaining anti-aliased slash/beam language. */
.titleScreen { justify-content:center !important; }
.titleScene { height:170px !important; }

/* The old rotated full-screen beam read as modern/vector. The projectile squares,
   charge sprite and impact burst now carry the direction on their own. */
.attackTrail { display:none !important; }
.attackCharge { width:36px !important; height:36px !important; }

/* Real HP damage is a hard frame flash plus pixel debris, never long smooth slashes. */
.damageVignette::before,
.damageVignette::after { display:none !important; }
.damageVignette i {
  width:8px !important;
  height:8px !important;
  background:#fff !important;
  box-shadow:8px 0 0 #d8334e,0 8px 0 #7b1428 !important;
  transform:none !important;
  animation:damagePixelShard8 .4s steps(4,end) both !important;
}
.damageVignette i:nth-of-type(1){ left:35% !important; top:60% !important; --px:-48px; --py:-58px; }
.damageVignette i:nth-of-type(2){ left:65% !important; top:60% !important; --px:48px; --py:-58px; }
.damageVignette i:nth-of-type(3){ left:38% !important; top:72% !important; --px:-54px; --py:44px; }
.damageVignette i:nth-of-type(4){ left:62% !important; top:72% !important; --px:54px; --py:44px; }
@keyframes damagePixelShard8 {
  0% { opacity:0; translate:0 0; }
  25%,55% { opacity:1; }
  100% { opacity:0; translate:var(--px) var(--py); }
}

.enemyAttackFx::before { display:none !important; }
.enemyAttackFx i {
  width:9px !important;
  height:9px !important;
  background:#fff !important;
  box-shadow:9px 0 0 #d8334e,0 9px 0 #7b1428 !important;
  transform:none !important;
  animation:enemyPixelShot8 .3s steps(4,end) both !important;
}
.enemyAttackFx i:nth-child(1){ left:24% !important; top:28% !important; --ex:120px; --ey:330px; }
.enemyAttackFx i:nth-child(2){ left:18% !important; top:32% !important; --ex:150px; --ey:300px; animation-delay:.04s !important; }
.enemyAttackFx i:nth-child(3){ left:30% !important; top:26% !important; --ex:100px; --ey:350px; animation-delay:.08s !important; }
@keyframes enemyPixelShot8 {
  0% { opacity:0; translate:0 0; }
  20%,70% { opacity:1; }
  100% { opacity:0; translate:var(--ex) var(--ey); }
}
.enemyAttack_pierce i { background:#dcecff !important; box-shadow:9px 0 0 #6688d8 !important; }
.enemyAttack_drain i { background:#ffb0cd !important; box-shadow:9px 0 0 #7a073b !important; }
.enemyAttack_disrupt i { background:#f2cf38 !important; box-shadow:9px 0 0 #7d3bb0,0 9px 0 #2fbf87 !important; }

/* Keep the bottom controls where a portrait phone player expects them. */
.actionBar { margin-top:auto; }

@media (max-height:760px) and (orientation:portrait) {
  .titleScreen { justify-content:center !important; }
  .titleScene { height:142px !important; }
}
'''
if 'TACTICAL_BALANCE_V3_VISUAL' not in css:
    css += extra
cssp.write_text(css)
