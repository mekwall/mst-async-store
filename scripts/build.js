const minify = require('@node-minify/core');
const gcc = require('@node-minify/google-closure-compiler');

// Using Google Closure Compiler
minify({
  compressor: gcc,
  input: './lib/*.js',
  output: './dist/mst-async-store.min.js',
  sync: true,
  options: {
    createSourceMap: true,
    applyInputSourceMaps: false,
  },
  callback: (err, min) => {
    if (err) {
      console.error(err);
    } else {
      console.log('Done!');
    }
  },
});
