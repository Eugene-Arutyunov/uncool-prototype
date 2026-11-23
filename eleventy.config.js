module.exports = function (conf) {
  conf.addPassthroughCopy("./src/assets");
  conf.addPassthroughCopy("./src/CNAME");
  conf.addWatchTarget("./src/styles/");
  conf.addGlobalData("year", () => new Date().getFullYear());
  // Редакторские комментарии на полях видны только в локальном предпросмотре (npm run dev)
  conf.addGlobalData("isLocalPreview", () => process.env.ELEVENTY_RUN_MODE === "serve");

  return {
    dir: {
      input: "./src",
      includes: "./includes",
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
};
