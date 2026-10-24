# -*- coding: utf-8 -*-
"""对拍夹具生成器：用 Python 实现（标准答案）批量产出 CastResult，供 TS 侧逐字段比对。

只读运行，不改任何项目文件。产物 web/tests/fixtures/parity_cases.json。
覆盖四种起卦法；object_direction 全枚举 8×8×12=768，其余系统抽样。
"""
import itertools
import json
import sys
from pathlib import Path

PROJ = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJ))

from plum.core.result import divine                      # noqa: E402
from plum.config.lineage import DIZHI, COLOR_TO_GUA      # noqa: E402

GUAS = ["乾", "兑", "离", "震", "巽", "坎", "艮", "坤"]
COLORS = sorted(COLOR_TO_GUA)

cases = []


def add(method, inputs, season=None):
    r = divine(method, season=season, **inputs)
    d = r.to_dict()
    d["ben_bits"] = list(d["ben_bits"])
    d["bian_bits"] = list(d["bian_bits"])
    cases.append({"method": method, "inputs": inputs, "season": season, "expected": d})


# ① object_direction 全枚举 8 × 8 × 12 = 768
for og, dg, h in itertools.product(GUAS, GUAS, DIZHI):
    add("object_direction", {"object_gua": og, "direction_gua": dg, "hour_dizhi": h})

# ② time：年支 12 × 月 {1,3,6,7,9,12} × 日 {1,7,15,17,28,30} × 时 {子,卯,申,酉,亥}
for y, m, dd, h in itertools.product(DIZHI, [1, 3, 6, 7, 9, 12], [1, 7, 15, 17, 28, 30],
                                     ["子", "卯", "申", "酉", "亥"]):
    add("time", {"year_dizhi": y, "lunar_month": m, "lunar_day": dd, "hour_dizhi": h})

# ③ sound：先响 1–9 × 后响 1–9 × 时 {子,辰,午,酉,亥}
for a, b, h in itertools.product(range(1, 10), range(1, 10), ["子", "辰", "午", "酉", "亥"]):
    add("sound", {"first_count": a, "second_count": b, "hour_dizhi": h})

# ④ color：上色 × 下色 × 时 {子,午,戌}
for uc, lc, h in itertools.product(COLORS, COLORS, ["子", "午", "戌"]):
    add("color", {"upper_color": uc, "lower_color": lc, "hour_dizhi": h})

# ⑤ 显式 season 覆盖（非 time 法也带节令）
for s in ["春", "夏", "秋", "冬", "土"]:
    add("object_direction", {"object_gua": "乾", "direction_gua": "震", "hour_dizhi": "辰"}, season=s)

out = Path(__file__).with_name("parity_cases.json")
out.write_text(json.dumps(cases, ensure_ascii=False), encoding="utf-8")
print(f"generated {len(cases)} cases -> {out.name} ({out.stat().st_size // 1024} KB)")
