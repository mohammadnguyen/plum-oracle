# -*- coding: utf-8 -*-
"""导出 Prompt 对拍夹具：Python build_duanshi_prompt 的 user 段（盘面事实部分）为标准答案。

TS 侧 buildExportPrompt().facts 须与之逐字一致。
注：Python user 段尾部可能附「同门范例(邵雍原著,gold)」块——TS 侧首批不含，
    故夹具在此处截断，只比对盘面事实部分（截断点记录在 fixture 里，供核查）。
"""
import itertools, json, os, sys
from pathlib import Path

os.environ["PLUM_STATS_DISABLED"] = "1"
PROJ = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJ))

from plum.core.result import divine                        # noqa: E402
from plum.rules.netassess import duanshi_full              # noqa: E402
from plum.interpreter.prompt import build_duanshi_prompt   # noqa: E402
from plum.config import lineage                            # noqa: E402
from plum.corpus.guayaoci import get_yaoci                 # noqa: E402

GOLD_MARK = "【同门范例(邵雍原著,gold)】"
cases = []


def add(method, inputs, men, question=None, posture=None, lunar_month=None):
    r = divine(method, **inputs)
    f = duanshi_full(men, r, posture=posture, lunar_month=lunar_month)
    dom = f["domain"]
    if question:
        dom["question"] = question
    d = r.to_dict()
    e = get_yaoci(d["ben_gua"], d["dong_yao"])
    specs = [{"gua_name": d["ben_gua"], "yao_pos": d["dong_yao"], "text": e["text"]}] \
        if e and not e.get("pending") else []
    p = build_duanshi_prompt(r, dom, specs, lineage.declarations())
    user = p["user"]
    truncated = GOLD_MARK in user
    facts = user.split(GOLD_MARK)[0].rstrip("\n") if truncated else user
    cases.append({"method": method, "inputs": inputs, "men": men, "question": question,
                  "posture": posture, "lunar_month": lunar_month,
                  "facts": facts, "gold_block_truncated": truncated,
                  "system": p["system"]})


GUAS = ["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"]
# 覆盖：四法 × 代表门类 × 有/无所问 × 特例（象义待核/封顶/化解大象/pending爻辞）
for og, dg, men in itertools.product(GUAS, ["乾", "坤", "坎"], [2, 5, 10]):
    add("object_direction", {"object_gua": og, "direction_gua": dg, "hour_dizhi": "午"}, men)
for y, m, dd, men in itertools.product(["辰", "午"], [3, 7], [12, 17], [1, 6, 10, 13]):
    add("time", {"year_dizhi": y, "lunar_month": m, "lunar_day": dd, "hour_dizhi": "申"}, men)
add("sound", {"first_count": 1, "second_count": 5, "hour_dizhi": "酉"}, 10)
add("color", {"upper_color": "青", "lower_color": "黑", "hour_dizhi": "戌"}, 12)
# 所问之事
add("object_direction", {"object_gua": "兑", "direction_gua": "艮", "hour_dizhi": "午"}, 5,
    question="今天一家人去订结婚的衣服 是否能够开心圆满收尾")
# 象义待核（山地剥人事占）/ 封顶 / 大象化解 / 旺衰接线
add("object_direction", {"object_gua": "艮", "direction_gua": "坤", "hour_dizhi": "巳"}, 2, lunar_month=6)
add("object_direction", {"object_gua": "乾", "direction_gua": "乾", "hour_dizhi": "戌"}, 5)
add("object_direction", {"object_gua": "坤", "direction_gua": "坎", "hour_dizhi": "午"}, 10, lunar_month=7)
add("object_direction", {"object_gua": "乾", "direction_gua": "巽", "hour_dizhi": "卯"}, 2, posture="行")
# pending 爻辞（革六二）：找一个本卦=泽火革 且动爻=2 的盘
for og, dg, h in itertools.product(GUAS, GUAS, ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"]):
    dd = divine("object_direction", object_gua=og, direction_gua=dg, hour_dizhi=h).to_dict()
    if dd["ben_gua"] == "泽火革" and dd["dong_yao"] == 2:
        add("object_direction", {"object_gua": og, "direction_gua": dg, "hour_dizhi": h}, 10)
        break

out = Path(__file__).with_name("prompt_cases.json")
out.write_text(json.dumps(cases, ensure_ascii=False), encoding="utf-8")
print(f"generated {len(cases)} prompt cases -> {out.name} ({out.stat().st_size // 1024} KB)")
print("gold block truncated in", sum(1 for c in cases if c['gold_block_truncated']), "cases")
