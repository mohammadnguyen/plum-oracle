/**
 * 语料层（CLAUDE.md §4.5）：权威源加载、pending 屏蔽、冒烟校验。
 * 移植自 plum/tests/ 中语料相关断言。
 */
import { describe, it, expect } from "vitest";
import { GUA64 } from "../src/engine/gua64.js";
import {
  smokeCheckShiLiusan, citedYaociUnlocked, corpusInfo,
  getYaoci, getGuaci, getGuaciInfo, isPending,
} from "../src/engine/corpus/guayaoci.js";

describe("§4.5 卦爻辞语料", () => {
  it("权威源已 verified 加载，引辞维度解锁，64 卦齐备", () => {
    const info = corpusInfo();
    expect(info.verified).toBe(true);
    expect(info.source).toBe("zhouyi_clean.json");
    expect(info.hexagrams).toBe(64);
    expect(citedYaociUnlocked()).toBe(true);
  });

  it("冒烟校验：地水师六三「师或舆尸，凶」逐字一致（§4.5 硬闸门）", () => {
    expect(smokeCheckShiLiusan()).toBe(true);
    const e = getYaoci("地水师", 3);
    expect(e?.text).toBe("师或舆尸，凶。");
    expect(e?.pending).toBe(false);
  });

  it("全 64 卦 × 6 爻覆盖：非 pending 单元全部可取得，pending 单元全部屏蔽", () => {
    let yaoOk = 0;
    let yaoPending = 0;
    let guaOk = 0;
    let guaPending = 0;
    for (const { name } of GUA64) {
      for (let pos = 1; pos <= 6; pos++) {
        const e = getYaoci(name, pos);
        expect(e, `${name} 第${pos}爻 取不到`).not.toBeNull();
        if (e!.pending) {
          expect(e!.text).toBeNull();   // pending 必屏蔽正文
          yaoPending++;
        } else {
          expect(e!.text).toBeTruthy();
          yaoOk++;
        }
      }
      const gi = getGuaciInfo(name);
      expect(gi, `${name} 卦辞取不到`).not.toBeNull();
      if (gi!.pending) {
        expect(gi!.text).toBeNull();
        guaPending++;
      } else {
        expect(gi!.text).toBeTruthy();
        guaOk++;
      }
    }
    expect(yaoOk + yaoPending).toBe(384);
    expect(guaOk + guaPending).toBe(64);
  });

  it("pending 单元正文被屏蔽（革卦辞 / 革六二 / 小过九三）", () => {
    // 革卦辞 pending：getGuaci 返回 null，但 isPending 为真（区分 pending 与缺失）
    expect(isPending("泽火革", 0)).toBe(true);
    expect(getGuaci("泽火革")).toBeNull();
    const gi = getGuaciInfo("泽火革");
    expect(gi?.pending).toBe(true);
    expect(gi?.text).toBeNull();
    // 革六二 pending
    expect(isPending("泽火革", 2)).toBe(true);
    expect(getYaoci("泽火革", 2)?.pending).toBe(true);
    expect(getYaoci("泽火革", 2)?.text).toBeNull();
  });

  it("非 pending 爻辞正常供给，且带传统爻题", () => {
    const e = getYaoci("乾为天", 1);
    expect(e?.pending).toBe(false);
    expect(e?.text).toBeTruthy();
    expect(e?.yname).toBeTruthy();
  });
});
