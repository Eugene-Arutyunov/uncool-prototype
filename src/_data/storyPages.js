// Страницы, которые собирает pagination в stories.njk.
// Истории с dedicatedPage: true живут отдельным HTML и сюда не входят.
module.exports = function () {
  delete require.cache[require.resolve("./stories.js")];
  return require("./stories.js").filter((story) => !story.dedicatedPage);
};
