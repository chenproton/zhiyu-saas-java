<template>
  <main class="changelog-page">
    <div class="changelog-container">
      <div class="changelog-eyebrow">Changelog</div>

      <template v-for="(block, i) in blocks" :key="i">
        <h1 v-if="block.type === 'h1'" class="block-h1">
          <InlineText :text="block.text" />
        </h1>

        <h2 v-else-if="block.type === 'h2'" class="block-h2">
          <span class="accent-bar" />
          <InlineText :text="block.text" />
        </h2>

        <ul v-else-if="block.type === 'list'" class="block-list">
          <li v-for="(item, j) in block.items" :key="j">
            <span class="dot" />
            <span><InlineText :text="item" /></span>
          </li>
        </ul>

        <div v-else-if="block.type === 'quote'" class="block-quote">
          <p v-for="(q, j) in block.lines" :key="j" :class="{ 'mt-1': j > 0 }">
            <InlineText :text="q" />
          </p>
        </div>

        <table v-else-if="block.type === 'table'" class="block-table">
          <thead>
            <tr>
              <th v-for="(cell, j) in block.header" :key="j">
                <InlineText :text="cell" />
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, j) in block.rows" :key="j">
              <td v-for="(cell, k) in row" :key="k">
                <InlineText :text="cell" />
              </td>
            </tr>
          </tbody>
        </table>

        <hr v-else-if="block.type === 'hr'" class="block-hr" />

        <p v-else-if="block.type === 'p'" class="block-p">
          <InlineText :text="block.text" />
        </p>
      </template>
    </div>
  </main>
</template>

<script setup lang="ts">
import { defineComponent, h } from 'vue';
import { CHANGELOG_MARKDOWN } from './changelog-content';

// 极简 markdown 子集渲染：标题 / 列表 / 引用 / 分隔线 / 表格 / **加粗** / 段落（对齐 React app/changelog/page.tsx）
const InlineText = defineComponent({
  name: 'ChangelogInlineText',
  props: { text: { type: String, required: true } },
  setup(props) {
    return () => {
      const parts = props.text.split(/(\*\*[^*]+\*\*)/g);
      return h(
        'span',
        parts.map((part, i) =>
          part.startsWith('**') && part.endsWith('**') && part.length > 4
            ? h('strong', { key: i, class: 'inline-bold' }, part.slice(2, -2))
            : h('span', { key: i }, part),
        ),
      );
    };
  },
});

type ChangelogBlock =
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'quote'; lines: string[] }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'hr' }
  | { type: 'p'; text: string };

function isTableSeparator(line: string): boolean {
  const cells = line.split('|').map((c) => c.trim());
  return cells.length > 1 && cells.every((c) => /^-{1,}$/.test(c));
}

function parseBlocks(markdown: string): ChangelogBlock[] {
  const lines = markdown.split('\n');
  const blocks: ChangelogBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith('#')) {
      const level = (line.match(/^#+/) ?? ['#'])[0].length;
      const text = line.replace(/^#+\s*/, '');
      blocks.push(level === 1 ? { type: 'h1', text } : { type: 'h2', text });
      i++;
      continue;
    }
    if (line.startsWith('- ')) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith('- ')) {
        items.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: 'list', items });
      continue;
    }
    if (line.startsWith('> ')) {
      const quotes: string[] = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        quotes.push(lines[i].slice(2));
        i++;
      }
      blocks.push({ type: 'quote', lines: quotes });
      continue;
    }
    if (line.startsWith('|')) {
      let header: string[] | null = null;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].startsWith('|')) {
        if (isTableSeparator(lines[i])) {
          i++;
          continue;
        }
        const cells = lines[i]
          .split('|')
          .slice(1, -1)
          .map((c) => c.trim());
        if (!header) header = cells;
        else rows.push(cells);
        i++;
      }
      if (header) blocks.push({ type: 'table', header, rows });
      continue;
    }
    if (/^-{3,}$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }
    blocks.push({ type: 'p', text: line });
    i++;
  }
  return blocks;
}

const blocks: ChangelogBlock[] = parseBlocks(CHANGELOG_MARKDOWN);
</script>

<style scoped>
.changelog-page {
  min-height: 100vh;
  background: #f7f9fc;
  padding-bottom: 64px;
}
.changelog-container {
  max-width: 768px;
  margin: 0 auto;
  padding: 40px 24px 0;
}
.changelog-eyebrow {
  margin-bottom: 24px;
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #98a2b3;
}
.block-h1 {
  margin: 8px 0 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: #0f172a;
}
.block-h2 {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 40px 0 0;
  padding-bottom: 8px;
  border-bottom: 1px solid #e2e8f0;
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
}
.accent-bar {
  display: inline-block;
  width: 4px;
  height: 16px;
  border-radius: 2px;
  background: #409eff;
  flex-shrink: 0;
}
.block-list {
  margin: 12px 0 0;
  padding-left: 4px;
  list-style: none;
}
.block-list li {
  display: flex;
  gap: 8px;
  margin-top: 6px;
  line-height: 1.75;
  color: #334155;
}
.dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #94a3b8;
  flex-shrink: 0;
  margin-top: 0.72em;
}
.block-quote {
  margin-top: 16px;
  padding: 12px 16px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #f8fafc;
  font-size: 14px;
  color: #475569;
}
.block-quote p {
  margin: 0;
  line-height: 1.7;
}
.mt-1 {
  margin-top: 4px;
}
.block-table {
  margin-top: 16px;
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.block-table th {
  padding: 8px 12px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
  font-weight: 600;
  color: #1e293b;
}
.block-table td {
  padding: 8px 12px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: top;
  color: #475569;
}
.block-hr {
  margin-top: 32px;
  border: none;
  border-top: 1px solid #e2e8f0;
}
.block-p {
  margin: 12px 0 0;
  line-height: 1.75;
  color: #334155;
}
.inline-bold {
  font-weight: 600;
}
</style>
