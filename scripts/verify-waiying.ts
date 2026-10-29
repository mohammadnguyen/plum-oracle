/**
 * 外应表的机器逐字核对（开发期运行；原书 TXT 属第三方版权、不进仓库，CI 拿不到，故不进 npm test）。
 *
 *   npx vite-node scripts/verify-waiying.ts [TXT 路径，默认 ../《梅花易数》.txt]
 *
 * 逐条断言：表中原文是所记那一行的子串；十应目论各句是 L1007 的子串。任何一条不过，进程以非零退出。
 */
import { readFileSync, existsSync } from "node:fs";
import { SHIYING_RULE, WAIYING } from "../src/engine/waiying.js";

const path = process.argv[2] ?? "../《梅花易数》.txt";
if (!existsSync(path)) {
  console.error(`找不到原书 TXT：${path}`);
  process.exit(2);
}
const lines = readFileSync(path, "utf8").split(/\r?\n/);

let bad = 0;
const check = (label: string, line: number, quote: string) => {
  const ok = (lines[line - 1] ?? "").includes(quote);
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} L${line} ${label.padEnd(10)} ${quote}`);
};
for (const x of WAIYING) check(x.id, x.line, x.quote);
for (const [k, v] of Object.entries(SHIYING_RULE)) if (k !== "line") check(k, SHIYING_RULE.line, String(v));

const n = WAIYING.length + Object.keys(SHIYING_RULE).length - 1;
console.log(bad ? `\n${bad} 条未通过` : `\n${n} 条全部逐字核对通过（${path}）`);
process.exit(bad ? 1 : 0);
