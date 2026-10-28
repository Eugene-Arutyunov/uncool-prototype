module.exports = function (conf) {
  conf.addPassthroughCopy("./src/assets");
  conf.addPassthroughCopy("./src/CNAME");
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
