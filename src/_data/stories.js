/*
  Истории. Порядок здесь = порядок в сетке на главной (см. grid.js).
  image — файл в /assets/stories/; без картинки в сетке будет серая заглушка.
  short — короткое название для столбика в виде «пачка» (по умолчанию title).
  ratio — пропорции картинки в сетке (кадрируется через object-fit: cover),
  без ratio картинка идёт в своих натуральных пропорциях.
  position — точка кадрирования, по умолчанию center.
*/
const stories = [
  { slug: "naydyotsya-vsyo", title: "«Найдётся всё»", image: "naydyotsya-vsyo.png", ratio: "3 / 2" },
  { slug: "yet-another-indexer", title: "Yet Another Indexer: откуда взялось имя", short: "Yet Another Indexer", image: "yet-another-indexer.png" },
  { slug: "koldunshchiki", title: "Колдунщики", image: "koldunshchiki.png", ratio: "1", position: "left top" },
  { slug: "probki", title: "Пробки в баллах", image: "probki.png" },
  { slug: "alisa", title: "Алиса", image: "alisa.png", ratio: "1" },
  { slug: "stantsiya", title: "Станция", image: "stantsiya.png", ratio: "5 / 7" },
  { slug: "goroda-algoritmy", title: "От Магадана до Палеха: алгоритмы с именами городов", short: "От Магадана до Палеха", image: "goroda-algoritmy.png", ratio: "6 / 5" },
  { slug: "rovery", title: "Роверы на тротуарах", image: "rovery.jpg" },
  { slug: "meteum", title: "Метеум", image: "meteum.png", ratio: "7 / 5" },
  { slug: "bespilotniki", title: "Беспилотники", image: "bespilotniki.jpg", ratio: "7 / 5" },
  { slug: "taksi", title: "Такси за пять минут", image: "taksi.jpg", ratio: "3 / 4" },
  { slug: "samokaty", title: "Самокаты рулят", image: "samokaty.jpg", ratio: "3 / 2" },
  { slug: "market", title: "Маркет", image: "market.jpg", ratio: "1" },
  { slug: "kinopoisk", title: "Кинопоиск", image: "kinopoisk.jpg", ratio: "8 / 5" },
  { slug: "lavka", title: "Лавка за 15 минут", image: "lavka.jpg" },
];

module.exports = stories.map((story) => ({
  ...story,
  url: `/stories/${story.slug}/`,
  image: story.image && `/assets/stories/${story.image}`,
}));
