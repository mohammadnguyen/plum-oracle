/**
 * 十二天将类象表的机器逐字核对（开发期运行，CI 不跑——要联网）。
 *
 *   npx vite-node scripts/verify-tianjiang.ts
 *
 * 按 TIANJIANG_SOURCE 钉死的提交取回《六壬大全》卷二原文，清洗规则与建表时一致：
 * 去掉 <pb:…> 分页标记、¶ 断行符、换行与全角空格。逐条断言：
 *   1. 原句在清洗后的原文中恰好出现一次；
 *   2. 落在本将自己的「某某論」之内；
 *   3. 所在页码与表中记录一致。
 * 任何一条不过，进程以非零退出。
 */
import { TIANJIANG_LEIXIANG, TIANJIANG_SOURCE } from "../src/engine/liuren/tianjiangLeixiang.js";

const S = TIANJIANG_SOURCE;
const url = `https://raw.githubusercontent.com/${S.repo}/${S.commit}/${S.file}`;
const raw = await (await fetch(url)).text();

let clean = "";
const page: string[] = [];
let cur = "";
for (let i = 0; i < raw.length; ) {
  if (raw.startsWith("<pb:", i)) {
    const j = raw.indexOf(">", i);
    cur = raw.slice(i + 4, j);
    i = j + 1;
    continue;
  }
  const ch = String.fromCodePoint(raw.codePointAt(i)!);
  i += ch.length;
  if (ch === "¶" || ch === "\n" || ch === "\r" || ch === "　") continue;
  clean += ch;
  for (let k = 0; k < ch.length; k++) page.push(cur);
}

const names = TIANJIANG_LEIXIANG.map((e) => e.nameInSource);
let bad = 0;
for (const e of TIANJIANG_LEIXIANG) {
  const pos = clean.indexOf(e.text);
  const count = clean.split(e.text).length - 1;
  const secStart = Math.max(...names.map((n) => clean.lastIndexOf(n + "論", pos)));
  const inOwn = clean.startsWith(e.nameInSource + "論", secStart);
  const okPage = pos >= 0 && page[pos] === e.page;
  const ok = count === 1 && inOwn && okPage;
  if (!ok) bad++;
  console.log(`${ok ? "✓" : "✗"} ${e.jiang}  出现${count}次  本将论内=${inOwn}  页码=${pos >= 0 ? page[pos] : "-"}${okPage ? "" : `（表中 ${e.page}）`}`);
}
console.log(bad ? `\n${bad} 条未通过` : `\n12 条全部逐字核对通过（${S.repo}@${S.commit.slice(0, 7)}）`);
process.exit(bad ? 1 : 0);
