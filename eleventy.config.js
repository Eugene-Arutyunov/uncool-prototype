module.exports = function (conf) {
  conf.addPassthroughCopy("./src/assets");
  conf.addPassthroughCopy("./src/CNAME");
  // демо справочника — готовая статика: копируем как есть, шаблонизатором не трогаем
  conf.ignores.add("./src/assets/stories/bible-demo/**");
  conf.addWatchTarget("./src/styles/");
  conf.addGlobalData("year", () => new Date().getFullYear());

  return {
    dir: {
      input: "./src",
      includes: "./includes",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
