const path = require("path");
const AddESLintDisablePlugin = require("./AddESLintDisablePlugin");

function createConfig(isMinified) {
  return {
    entry: "./public/lex-web-ui-loader/js/index.js",
    output: {
      path: path.resolve(__dirname, "public/lex-web-ui-loader/js"),
      filename: isMinified ? "chatbot.min.js" : "chatbot.js",
      library: "ChatBotUiLoader",
    },
    optimization: {
      minimize: isMinified,
    },
    plugins: [new AddESLintDisablePlugin()],
    mode: isMinified ? "production" : "development",
  };
}

// Export two configurations: one for minified and one for regular
module.exports = [createConfig(true), createConfig(false)];
