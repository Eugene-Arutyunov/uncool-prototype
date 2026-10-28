/*
  30 историй. Порядок = порядок в сетке.
  image — файл в /assets/stories/ (логотипы и фото с Wikimedia Commons и сайтов сервисов)
  kind — как ставить картинку в блок: logo, wordmark (широкий логотип), photo, ui (скриншот, кадрируется от верха)

  Ширина блоков считается по шаблонам строк ниже, а не задаётся руками:
  число — позиция двойного блока в строке, null — строка без двойного.
  Так при перестановке историй сетка не разваливается.
*/
const stories = [
  { slug: "naydyotsya-vsyo", title: "«Найдётся всё»", image: "naydyotsya-vsyo.png", kind: "logo" },
  { slug: "yet-another-indexer", title: "Yet Another Indexer: откуда взялось имя", image: "yet-another-indexer.jpg", kind: "photo" },
  { slug: "koldunshchiki", title: "Колдунщики", image: "koldunshchiki.jpg", kind: "ui" },
  { slug: "probki", title: "Пробки в баллах", image: "probki.png", kind: "logo" },
  { slug: "goroda-algoritmy", title: "От Магадана до Палеха: алгоритмы с именами городов", image: "goroda-algoritmy.png", kind: "logo" },
  { slug: "alisa", title: "Алиса", image: "alisa.png", kind: "logo" },
  { slug: "stantsiya", title: "Станция", image: "stantsiya.jpg", kind: "photo" },
  { slug: "bespilotniki", title: "Беспилотники", image: "bespilotniki.jpg", kind: "photo" },
  { slug: "rovery", title: "Роверы на тротуарах", image: "rovery.jpg", kind: "photo" },
  { slug: "taksi", title: "Такси за пять минут", image: "taksi.jpg", kind: "photo" },
  { slug: "kinopoisk", title: "Кинопоиск", image: "kinopoisk.png", kind: "wordmark" },
  { slug: "moya-volna", title: "Моя волна", image: "moya-volna.png", kind: "logo" },
  { slug: "meteum", title: "Метеум: погода до минуты", image: "meteum.png", kind: "logo" },
  { slug: "market", title: "Маркет", image: "market.png", kind: "wordmark" },
  { slug: "lavka", title: "Лавка за 15 минут", image: "lavka.jpg", kind: "photo" },
  { slug: "direkt", title: "Директ", image: "direkt.png", kind: "logo" },
  { slug: "krasnaya-roza", title: "Офис в «Красной Розе»", image: "krasnaya-roza.jpg", kind: "photo" },
  { slug: "shad", title: "ШАД", image: "shad.png", kind: "ui" },
  { slug: "ipo", title: "IPO на NASDAQ", image: "ipo.jpg", kind: "photo" },
  { slug: "brauzer", title: "Браузер", image: "brauzer.png", kind: "logo" },
  { slug: "panoramy", title: "Панорамы", image: "panoramy.jpg", kind: "photo" },
  { slug: "narodnaya-karta", title: "Народная карта", image: "narodnaya-karta.png", kind: "logo" },
  { slug: "perevodchik", title: "Переводчик", image: "perevodchik.png", kind: "logo" },
  { slug: "dzen", title: "Дзен", image: "dzen.png", kind: "logo" },
  { slug: "superkompyutery", title: "Суперкомпьютеры с именами учёных", image: "superkompyutery.jpg", kind: "photo" },
  { slug: "shedevrum", title: "Шедеврум", image: "shedevrum.jpg", kind: "ui" },
  { slug: "plus", title: "Плюс", image: "plus.png", kind: "logo" },
  { slug: "catboost", title: "CatBoost", image: "catboost.png", kind: "logo" },
  { slug: "clickhouse", title: "ClickHouse", image: "clickhouse.png", kind: "logo" },
  { slug: "pochta", title: "Почта", image: "pochta.png", kind: "logo" },
];

const rows = {
  desktop: { columns: 5, pattern: [0, null, 3, 1, null, 2, 0] },
  mobile: { columns: 3, pattern: [1, null, 0, null] },
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

const desktop = wideFlags(stories.length, rows.desktop);
const mobile = wideFlags(stories.length, rows.mobile);

module.exports = stories.map((story, i) => ({
  ...story,
  url: `/stories/${story.slug}/`,
  image: `/assets/stories/${story.image}`,
  wide: { desktop: desktop[i], mobile: mobile[i] },
}));
