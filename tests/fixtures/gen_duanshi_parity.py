# -*- coding: utf-8 -*-
"""断事层对拍夹具：duanshi_full 全输出，Python 为标准答案。只读运行。

覆盖 四种起卦法 × 19 门类，附 posture / lunar_month 变体。
"""
import itertools
import json
import os
import sys
from pathlib import Path

os.environ["PLUM_STATS_DISABLED"] = "1"      # 禁止写 trigger_audit.json（只读运行）

PROJ = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJ))

from plum.core.result import divine                       # noqa: E402
from plum.rules.netassess import duanshi_full             # noqa: E402
from plum.rules.duanshi_lookup import load_rules          # noqa: E402

MEN_IDS = [d["men_id"] for d in load_rules()["doors"]]
GUAS = ["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"]
cases = []


def add(method, inputs, men, posture=None, lunar_month=None):
    r = divine(method, **inputs)
    f = duanshi_full(men, r, posture=posture, lunar_month=lunar_month)
    # domain 含大量重复引用，对拍取顶层可判分字段
    keep = {k: f[k] for k in (
        "domain_semantics", "base_polarity", "net_d", "final_verdict", "verdict_from",
        "xiangyi_review_flag", "net_return_hint", "net_applicable",
        "guaci_refs", "text_conflict", "wangshuai", "balance_required",
        "huajie", "yingqi", "leixiang_whitelist")}
    keep["wangshuai_readable"] = f.get("wangshuai_readable")
    cases.append({"method": method, "inputs": inputs, "men": men,
                  "posture": posture, "lunar_month": lunar_month, "expected": keep})


# ① 指物法 × 全门类：8 卦 × 4 卦 × 3 时 × 19 门（抽样 object/direction 减量）
for og, dg, h, men in itertools.product(GUAS, ["乾", "震", "坎", "坤"], ["子", "午", "酉"], MEN_IDS):
    add("object_direction", {"object_gua": og, "direction_gua": dg, "hour_dizhi": h}, men)

# ② time 法 × 全门类（time 走先天卦气路由，与 ① 的后天路由互补）
for y, m, dd, h, men in itertools.product(["辰", "巳", "午"], [3, 7, 12], [12, 17], ["申", "卯"], MEN_IDS):
    add("time", {"year_dizhi": y, "lunar_month": m, "lunar_day": dd, "hour_dizhi": h}, men)

# ③ sound / color × 常用门类
for a, b, h, men in itertools.product([1, 5, 8], [2, 5, 9], ["酉", "午"], [2, 5, 10, 16]):
    add("sound", {"first_count": a, "second_count": b, "hour_dizhi": h}, men)
for uc, lc, h, men in itertools.product(["青", "赤", "白"], ["黑", "黄", "白"], ["戌"], [2, 10, 12]):
    add("color", {"upper_color": uc, "lower_color": lc, "hour_dizhi": h}, men)

# ④ posture 三档 + lunar_month 旺衰接线
for p in ["行", "坐", "立", None]:
    add("object_direction", {"object_gua": "乾", "direction_gua": "巽", "hour_dizhi": "卯"}, 2, posture=p)
for lm in range(1, 13):
    add("object_direction", {"object_gua": "震", "direction_gua": "离", "hour_dizhi": "酉"}, 10, lunar_month=lm)

# ⑤ 已知特例：西林寺型全比和 / 封顶触发 / 化解大象
add("object_direction", {"object_gua": "艮", "direction_gua": "坤", "hour_dizhi": "巳"}, 2, lunar_month=6)
add("object_direction", {"object_gua": "乾", "direction_gua": "乾", "hour_dizhi": "戌"}, 5)
add("object_direction", {"object_gua": "坤", "direction_gua": "坎", "hour_dizhi": "午"}, 10, lunar_month=7)

out = Path(__file__).with_name("duanshi_cases.json")
out.write_text(json.dumps(cases, ensure_ascii=False), encoding="utf-8")
print(f"generated {len(cases)} duanshi cases -> {out.name} ({out.stat().st_size // 1024} KB)")
