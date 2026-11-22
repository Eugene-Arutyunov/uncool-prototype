const path = require("node:path");
const configure = require("../../eleventy.config.js");
const { model, annotate, editorPage } = require("./server.cjs");
const source = path.resolve(
  __dirname,
  "../../src/stories/s-bozhey-pomoshchyu.html",
);

module.exports = (conf) => {
  const settings = configure(conf);
  let version;
  conf.addPreprocessor("inline-bible-story", "html", (data, content) => {
    if (path.resolve(data.page.inputPath) !== source) return content;
    version = model(content).version;
    return annotate(content);
  });
  conf.addTransform("inline-bible-story-ui", function (content) {
    return path.resolve(this.page.inputPath) === source
      ? editorPage(content, version)
      : content;
  });
  return settings;
};
