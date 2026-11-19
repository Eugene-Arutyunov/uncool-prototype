/*
  Синхронизация Notion → репозиторий для страницы /database/.

  Забирает две базы («Истории» и «Запрос данных»), оставляет только поля,
  которые можно показывать заказчику, и пишет результат в
  src/database/data/database.json. Картинки из карточек скачивает
  в src/assets/database/ (ссылки Notion на файлы живут около часа).

  Запуск: NOTION_TOKEN=secret_xxx node scripts/notion-sync.mjs
  Зависимостей нет, нужен Node 18+.

  Что показываем, а что нет — см. normalizeStory() и normalizeRequest().
*/
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STORIES_DATA_SOURCE = "782cb6a9-3292-4c0c-a9de-09da4e45ee42";
const REQUESTS_DATA_SOURCE = "41d35c60-d31a-8150-aa7d-000b54ef2909";
const NOTION_VERSION = "2025-09-03";
const NOTION_API = process.env.NOTION_API_URL || "https://api.notion.com/v1";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_FILE = path.join(root, "src/database/data/database.json");
const ASSETS_DIR = path.join(root, "src/assets/database");
const ASSETS_URL = "/assets/database";

/* ---------- текст ---------- */

export const compactId = (id) => String(id || "").replace(/-/g, "");

export const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const plain = (richText) => (richText || []).map((t) => t.plain_text).join("").trim();

/* Ссылки на «файлы» вроде http://kniga.md Notion делает сам из имён md-файлов — это не источники. */
const isRealLink = (url) => {
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) && !u.hostname.toLowerCase().endsWith(".md");
  } catch {
    return false;
  }
};

/* Из поля «Источник» наружу идут только внешние ссылки, без имён внутренних файлов. */
export function extractLinks(text, hrefs = []) {
  const found = [...hrefs, ...(String(text || "").match(/https?:\/\/[^\s<>"]+/g) || [])]
    .map((u) => u.replace(/[),.;]+$/, ""))
    .filter(isRealLink);
  return [...new Set(found)];
}

function richTextToHtml(richText) {
  return (richText || [])
    .map((t) => {
      let html = escapeHtml(t.plain_text).replace(/\n/g, "<br>");
      const a = t.annotations || {};
      if (a.code) html = `<code>${html}</code>`;
      if (a.bold) html = `<strong>${html}</strong>`;
      if (a.italic) html = `<em>${html}</em>`;
      if (a.strikethrough) html = `<s>${html}</s>`;
      if (t.href && isRealLink(t.href)) html = `<a href="${escapeHtml(t.href)}" target="_blank" rel="noopener">${html}</a>`;
      return html;
    })
    .join("");
}

/* ---------- свойства ---------- */

const prop = (page, name) => page.properties?.[name];
const textProp = (page, name) => plain(prop(page, name)?.rich_text || prop(page, name)?.title);
const hrefsProp = (page, name) => (prop(page, name)?.rich_text || []).map((t) => t.href).filter(Boolean);

export function normalizeStory(page) {
  return {
    id: compactId(page.id),
    title: textProp(page, "Name"),
    status: prop(page, "Статус")?.status?.name || "",
    unit: prop(page, "Юнит")?.select?.name || "",
    about: textProp(page, "О чем история"),
    hero: textProp(page, "Герой истории"),
    note: textProp(page, "Заметка исследователя"),
    links: extractLinks(textProp(page, "Источник"), hrefsProp(page, "Источник")),
    body: "",
    // Не выгружаем: «Заголовок для прототипа», «Раскрытие рамки», «Вопросы», «Кто пишет», «Исследование».
  };
}

export function normalizeRequest(page) {
  return {
    id: compactId(page.id),
    title: textProp(page, "Что нужно"),
    storyIds: (prop(page, "История")?.relation || []).map((r) => compactId(r.id)),
    hero: textProp(page, "Предполагаемый герой"),
    types: (prop(page, "Тип")?.multi_select || []).map((o) => o.name),
    status: prop(page, "Статус")?.status?.name || "",
    comment: textProp(page, "Комментарий"),
  };
}

/* ---------- тело карточки ---------- */

/* blocks — блоки Notion с уже подгруженными children. Возвращает HTML. */
export function blocksToHtml(blocks, images = new Map()) {
  let html = "";
  let list = null; // "ul" | "ol"
  const closeList = () => {
    if (list) html += `</${list}>`;
    list = null;
  };

  for (const block of blocks) {
    const data = block[block.type] || {};
    const text = richTextToHtml(data.rich_text);
    const children = block.children?.length ? blocksToHtml(block.children, images) : "";

    if (block.type === "bulleted_list_item" || block.type === "numbered_list_item" || block.type === "to_do") {
      const tag = block.type === "numbered_list_item" ? "ol" : "ul";
      if (list !== tag) {
        closeList();
        html += `<${tag}>`;
        list = tag;
      }
      html += `<li>${text}${children}</li>`;
      continue;
    }
    closeList();

    switch (block.type) {
      case "paragraph":
        if (text) html += `<p>${text}</p>`;
        html += children;
        break;
      case "heading_1":
      case "heading_2":
      case "heading_3":
        if (text) html += `<h4>${text}</h4>`;
        html += children;
        break;
      case "quote":
      case "callout":
        html += `<blockquote>${text ? `<p>${text}</p>` : ""}${children}</blockquote>`;
        break;
      case "toggle":
        html += `<p>${text}</p>${children}`;
        break;
      case "code":
        html += `<pre>${text}</pre>`;
        break;
      case "divider":
        html += "<hr>";
        break;
      case "image": {
        const src = images.get(block.id);
        const caption = richTextToHtml(data.caption);
        if (src) html += `<figure><img src="${escapeHtml(src)}" alt="" loading="lazy">${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
        break;
      }
      case "bookmark":
      case "embed":
      case "video":
      case "link_preview": {
        const url = data.url || data.external?.url;
        if (url && isRealLink(url)) html += `<p><a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(url)}</a></p>`;
        break;
      }
      default:
        // таблицы, базы, файлы и прочее пропускаем; вложенный текст сохраняем
        html += children;
    }
  }
  closeList();
  return html;
}

/* ---------- Notion API ---------- */

async function notion(pathname, body) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`${NOTION_API}/${pathname}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${process.env.NOTION_TOKEN}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.ok) return res.json();
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const wait = Number(res.headers.get("retry-after")) || attempt * 2;
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    throw new Error(`Notion ${res.status} на ${pathname}: ${await res.text()}`);
  }
}

async function queryAll(dataSourceId) {
  const pages = [];
  let cursor;
  do {
    const res = await notion(`data_sources/${dataSourceId}/query`, { page_size: 100, start_cursor: cursor });
    pages.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  return pages.filter((p) => !p.archived && !p.in_trash);
}

async function statusOptions(dataSourceId) {
  const ds = await notion(`data_sources/${dataSourceId}`);
  const status = ds.properties?.["Статус"]?.status;
  if (!status) return [];
  // порядок как в настройках свойства «Статус» в Notion
  return status.options.map((o) => ({ name: o.name, color: o.color }));
}

async function loadBlocks(blockId, depth = 0) {
  const blocks = [];
  let cursor;
  do {
    const res = await notion(`blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`);
    blocks.push(...res.results);
    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);
  if (depth < 3) {
    for (const block of blocks) {
      if (block.has_children && block.type !== "child_page" && block.type !== "child_database") {
        block.children = await loadBlocks(block.id, depth + 1);
      }
    }
  }
  return blocks;
}

async function downloadImages(blocks, images, keep) {
  for (const block of blocks) {
    if (block.type === "image") {
      const url = block.image?.file?.url || block.image?.external?.url;
      if (url) {
        try {
          const res = await fetch(url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const type = res.headers.get("content-type") || "";
          const ext = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg" }[type.split(";")[0]] || "png";
          const name = `${compactId(block.id)}.${ext}`;
          await writeFile(path.join(ASSETS_DIR, name), Buffer.from(await res.arrayBuffer()));
          images.set(block.id, `${ASSETS_URL}/${name}`);
          keep.add(name);
        } catch (e) {
          console.warn(`Картинка ${block.id} не скачалась: ${e.message}`);
        }
      }
    }
    if (block.children) await downloadImages(block.children, images, keep);
  }
}

/* ---------- запуск ---------- */

async function main() {
  if (!process.env.NOTION_TOKEN) {
    console.error("Нет NOTION_TOKEN. Запуск: NOTION_TOKEN=secret_xxx node scripts/notion-sync.mjs");
    process.exit(1);
  }
  await mkdir(ASSETS_DIR, { recursive: true });
  await mkdir(path.dirname(DATA_FILE), { recursive: true });

  const [storyPages, requestPages, storyStatuses, requestStatuses] = await Promise.all([
    queryAll(STORIES_DATA_SOURCE),
    queryAll(REQUESTS_DATA_SOURCE),
    statusOptions(STORIES_DATA_SOURCE),
    statusOptions(REQUESTS_DATA_SOURCE),
  ]);

  const keep = new Set();
  const stories = [];
  for (const page of storyPages) {
    const story = normalizeStory(page);
    const blocks = await loadBlocks(page.id);
    const images = new Map();
    await downloadImages(blocks, images, keep);
    story.body = blocksToHtml(blocks, images);
    stories.push(story);
  }
  stories.sort((a, b) => a.title.localeCompare(b.title, "ru"));

  const storyIds = new Set(stories.map((s) => s.id));
  const requests = requestPages
    .map(normalizeRequest)
    .filter((r) => r.title && r.storyIds.some((id) => storyIds.has(id)));

  // убираем картинки, которых больше нет в Notion
  for (const file of await readdir(ASSETS_DIR)) {
    if (!keep.has(file) && file !== ".gitkeep") await rm(path.join(ASSETS_DIR, file));
  }

  const data = { syncedAt: new Date().toISOString(), storyStatuses, requestStatuses, stories, requests };
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2) + "\n");
  console.log(`Готово: историй ${stories.length}, запросов ${requests.length}, картинок ${keep.size}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
