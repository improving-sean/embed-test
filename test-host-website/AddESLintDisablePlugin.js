class AddESLintDisablePlugin {
  apply(compiler) {
    compiler.hooks.emit.tapAsync(
      "AddESLintDisablePlugin",
      (compilation, callback) => {
        Object.keys(compilation.assets).forEach((filename) => {
          if (/\.js$/.test(filename)) {
            // Adjust this condition as needed
            const asset = compilation.assets[filename];
            let content = "/* eslint-disable */\n";
            content += asset.source();
            compilation.assets[filename] = {
              source: () => content,
              size: () => content.length,
            };
          }
        });
        callback();
      }
    );
  }
}
module.exports = AddESLintDisablePlugin;
