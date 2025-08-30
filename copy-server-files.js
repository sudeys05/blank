const fs = require('fs-extra');

fs.copySync('server', 'dist/server', {
  filter: (src) => src.endsWith('.js') || fs.lstatSync(src).isDirectory()
});