/**
 * 旺相休囚、六亲所用《六壬大全》引文的机器逐字核对（开发期运行，CI 不跑——要联网）。
 *
 *   npx vite-node scripts/verify-liuren.ts
 *
 * 按 DAQUAN_PIN 钉死的提交取回各卷原文，清洗规则见 src/engine/liuren/daquan.ts：
 * 去掉 <pb:…> 分页、¶ 断行、换行、全角空格，以及注文排版记号「(」「)」「/」。逐条断言：
 *   1. 引文在该卷清洗后的原文中出现的次数与表中记录一致；
 *   2. 首次出现的页与表中记录一致。
 * 任何一条不过，进程以非零退出。
 */
import { DAQUAN_PIN, DAQUAN_QUOTES } from "../src/engine/liuren/daquan.js";

const cache = new Map<string, { clean: string; page: string[] }>();
async function load(juan: string) {
  const hit = cache.get(juan);
  if (hit) return hit;
  const url = `https://raw.githubusercontent.com/${DAQUAN_PIN.repo}/${DAQUAN_PIN.commit}/KR3g0031_${juan}.txt`;
  const raw = await (await fetch(url)).text();
  let clean = "";
  const page: string[] = [];
  let cur = "";
  for (let i = 0; i < raw.length; ) {
    if (raw.startsWith("<pb:", i)) {
      const j = raw.indexOf(">", i);
      cur = raw.slice(i + 4, j).replace(/^KR3g0031_WYG_/, "");
      i = j + 1;
      continue;
    }
    const ch = String.fromCodePoint(raw.codePointAt(i)!);
    i += ch.length;
    if ("¶\n\r　()/".includes(ch)) continue;
    clean += ch;
    for (let k = 0; k < ch.length; k++) page.push(cur);
  }
  const v = { clean, page };
  cache.set(juan, v);
  return v;
}

let bad = 0;
const all = Object.entries(DAQUAN_QUOTES);
for (const [key, x] of all) {
  const { clean, page } = await load(x.juan);
  const count = clean.split(x.text).length - 1;
  const pos = clean.indexOf(x.text);
  const pg = pos >= 0 ? page[pos] : "-";
  const ok = count === x.count && pg === x.page;
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} ${key.padEnd(10)} 卷${x.juan} 出现${count}次（表中 ${x.count}） 页=${pg}${pg === x.page ? "" : `（表中 ${x.page}）`}  ${x.text}`);
}
console.log(bad ? `\n${bad} 条未通过` : `\n${all.length} 条全部逐字核对通过（${DAQUAN_PIN.repo}@${DAQUAN_PIN.commit.slice(0, 7)}）`);
process.exit(bad ? 1 : 0);
