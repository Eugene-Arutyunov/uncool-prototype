/*
  Данные страницы /database/. Источник — data/database.json,
  его раз в сутки перезаписывает scripts/notion-sync.mjs.
  Здесь только подготовка к показу: группировка, ссылки, абзацы.
*/
const raw = require("./data/database.json");

/* Только для локального превью: тестовые запросы из файла, который не попадает в git. */
try {
  raw.requests = raw.requests.concat(require("./data/demo-requests.local.json"));
} catch {}

const escapeHtml = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const linkLabel = (url) => {
  try {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname + u.search).replace(/\/$/, "");
    const label = u.hostname.replace(/^www\./, "") + path;
    return label.length > 64 ? label.slice(0, 63) + "…" : label;
  } catch {
    return url;
  }
};

const link = (url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${escapeHtml(linkLabel(url))}</a>`;

/* Текст из Notion → абзацы, адреса превращаются в ссылки. */
const textToHtml = (text) =>
  String(text || "")
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((p) => {
      const html = p
        .split(/(https?:\/\/[^\s<>"]+)/g)
        .map((part, i) => (i % 2 ? link(part) : escapeHtml(part)))
        .join("")
        .replace(/\n/g, "<br>");
      return `<p>${html}</p>`;
    })
    .join("");

const splitList = (text) =>
  String(text || "")
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s && s !== "—");

const formatDate = (iso) => {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Moscow" }).format(d);
  const time = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow" }).format(d);
  return `${date.replace(" г.", "")}, ${time} по Москве`;
};

const colorOf = (statuses, name) => (statuses.find((s) => s.name === name) || {}).color || "default";

const storyById = new Map(raw.stories.map((s) => [s.id, s]));
const doneStatus = raw.requestStatuses.length ? raw.requestStatuses[raw.requestStatuses.length - 1].name : "";

const requests = raw.requests.map((r) => ({
  ...r,
  statusColor: colorOf(raw.requestStatuses, r.status),
  done: r.status === doneStatus,
  commentHtml: textToHtml(r.comment),
  stories: r.storyIds.map((id) => storyById.get(id)).filter(Boolean).map((s) => ({ id: s.id, title: s.title })),
}));
const requestOrder = (r) => raw.requestStatuses.findIndex((s) => s.name === r.status);
requests.sort((a, b) => requestOrder(a) - requestOrder(b));

const stories = raw.stories.map((s) => ({
  ...s,
  aboutHtml: textToHtml(s.about),
  heroes: splitList(s.hero),
  noteHtml: textToHtml(s.note),
  linksHtml: s.links.map(link),
  requests: requests.filter((r) => r.storyIds.includes(s.id)),
}));
for (const s of stories) s.openRequests = s.requests.filter((r) => !r.done).length;

/* Запросы по историям: сначала истории, где что-то ещё не получено. Запрос на две истории виден в обеих. */
const requestGroups = stories
  .filter((s) => s.requests.length)
  .map((s) => ({ id: s.id, title: s.title, requests: s.requests, open: s.openRequests, first: Math.min(...s.requests.map(requestOrder)) }))
  .sort((a, b) => (b.open > 0) - (a.open > 0) || a.first - b.first || a.title.localeCompare(b.title, "ru"));

const statusNames = raw.storyStatuses.map((s) => s.name);
for (const s of stories) if (!statusNames.includes(s.status)) statusNames.push(s.status);
const groups = statusNames
  .map((name) => ({ name, color: colorOf(raw.storyStatuses, name), stories: stories.filter((s) => s.status === name) }))
  .filter((g) => g.stories.length);

const units = [...new Set(stories.map((s) => s.unit).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));

module.exports = {
  db: {
    syncedAt: formatDate(raw.syncedAt),
    requests,
    requestGroups,
    openRequests: requests.filter((r) => !r.done).length,
    groups,
    units,
    total: stories.length,
  },
};
