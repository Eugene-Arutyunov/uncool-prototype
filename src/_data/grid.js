/*
  Сетка на главной: истории + вставки-цитаты.
  Цитата ссылается на историю и встаёт в сетку на позицию after (с нуля, считая ячейку заголовка).

  Ширина блоков считается по шаблонам строк, а не задаётся руками:
  число — позиция двойного блока в строке, null — строка без двойного.
  Так при перестановке историй сетка не разваливается.
*/

const quotes = [
  {
    story: "naydyotsya-vsyo",
    caption: "Событие",
    after: 10,
    text: "«Какая-то цитата, зацените, прочитайте, поностальгируйте»",
    portraits: ["/assets/stories/portrait-01.png", "/assets/stories/portrait-02.png"],
  },
];

const rows = {
  desktop: { columns: 5, pattern: [null, 3, 1, 0] },
  mobile: { columns: 3, pattern: [0, null, 1, null] },
};

function wideFlags(count, { columns, pattern }) {
  const flags = [];
  let row = 0;
  while (flags.length < count) {
    const widePos = pattern[row % pattern.length];
    const items = widePos === null ? columns : columns - 1;
    for (let i = 0; i < items && flags.length < count; i++) flags.push(i === widePos);
    row++;
  }
  return flags;
}

// Экспортируем функцию: Eleventy вызывает её на каждой сборке, и stories.js
// перечитывается заново (иначе dev-сервер не видит правок в stories.js).
module.exports = function () {
  delete require.cache[require.resolve("./stories.js")];
  const stories = require("./stories.js");

  // первая ячейка — заголовок страницы
  const items = [{ type: "heading" }, ...stories.map((story) => ({ type: "story", ...story }))];
  for (const quote of [...quotes].sort((a, b) => a.after - b.after)) {
    const story = stories.find((s) => s.slug === quote.story);
    items.splice(quote.after, 0, { type: "quote", ...quote, title: quote.caption || story.title, url: story.url });
  }

  // на мобильном заголовок и цитата занимают всю строку, поэтому в шаблоне строк их не считаем
  const fullRowMobile = (item) => item.type === "quote" || item.type === "heading";
  const desktop = wideFlags(items.length, rows.desktop);
  const mobile = wideFlags(items.filter((item) => !fullRowMobile(item)).length, rows.mobile);

  let m = 0;
  return items.map((item, i) => ({
    ...item,
    wide: { desktop: desktop[i], mobile: fullRowMobile(item) ? false : mobile[m++] },
  }));
};
