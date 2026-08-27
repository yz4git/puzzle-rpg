# RPG MODE Balance Report

## Scope

RPG MODE v1.0 の最終バランス確認。実ブラウザで主要導線と最終戦を操作し、加えて実装済み敵データ・Intent・成長式・装備補正を用いた決定論的フルルートモデルを5系統で各300回実行した。

## Browser play record

検証環境は縦画面基準（402×690想定）とSites preview。タイトルからNEW GAME、会話、MEMO、フィールド移動、地形エンカウント、RPG COMMAND、STATUS、RUN、Chapter Battle復帰、SAVE EXPORT/IMPORT、PRISM SOVEREIGN、ENDING、タイトル復帰まで確認した。

| Check | Result |
| --- | --- |
| Field encounter | ROAD外を15歩でLAKE IMPと遭遇 |
| RPG command | STATUSはターン非消費、RUNで通常戦から復帰 |
| Final boss | 23ターン、残HP54/54、ITEM 0、GAME OVER 0 |
| Boss phases | HP50%でPhase 2、HP25%でPhase 3へ遷移 |
| Story integration | 4 RELEASESを反映してPRISM RAY/COLLAPSEが弱体化 |
| Ending | 勝利会話→2ページENDING→TITLEへ復帰 |
| Browser errors | アプリ由来のconsole errorなし（検証ブラウザ拡張のmetadata errorのみ） |

## Five-archetype route model

各系統300回、計1,500ルート。通常敵、特殊敵、固定BOSS、最終BOSSを含む26戦を順番に通し、戦闘不能時は宿復帰相当で最大3回まで再戦した。乱数seedは固定し、結果を再現可能にしている。

| Archetype | Turns / fight | Min HP | Game over / route | Boss first clear | Items | Alt success | End LV | Top failure |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| STANDARD | 15.6 | 0.4 | 3.00 | 75.0% | 11.6 | 88.8% | 6.1 | NULL EXECUTIONER |
| ATK | 10.7 | 0.1 | 4.96 | 65.8% | 17.1 | 79.4% | 6.2 | NULL EXECUTIONER |
| HEAL | 17.6 | 3.2 | 1.80 | 81.2% | 3.6 | 91.0% | 6.1 | SCARLET ORACLE |
| BAR | 17.5 | 0.4 | 3.51 | 81.6% | 8.4 | 91.2% | 6.0 | NULL EXECUTIONER |
| SKIP | 14.4 | 4.4 | 0.60 | 92.6% | 2.5 | 89.8% | 6.1 | NULL EXECUTIONER |

## Decisions from the pass

- 攻撃偏重は最速だが消耗品と再挑戦が増えるため、速さと安全性の交換が成立している。
- SKIP型は安全性が高い一方、最速にはならない。Intentを読む価値を維持した。
- HEAL/BAR型は長期戦になるがBOSS初回突破率が高い。
- 別決着はEXP 35%、GOLD 20%とし、撃破の成長効率を残しつつ情報・技・イベント報酬を主目的にした。
- NULL EXECUTIONERは終盤の最大壁として維持。重要装備、宿、アイテム補給、TALKによる躊躇を直前導線に用意した。
- MAX HPはLV1=20、LV5=24、LV10=30。盤面の1 PANEL = 1 EFFECTを崩す数値インフレは入れていない。

## Reproduction

```sh
npm run balance:rpg
```

モデルは実プレイの代替ではなく、系統間の偏りと再現可能な回帰検査に使う。主要フロー、最終BOSS、エンディングは実ブラウザ操作で別途確認している。
