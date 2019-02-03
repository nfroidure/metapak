const pkgDir = require('pkg-dir');
const { autoService } = require('knifecycle');

module.exports = autoService(async function initProjectDir({ exit, log }) {
  const projectDir = await pkgDir();

  if (projectDir) {
    log('debug', 'Found the project dir:', projectDir);
    return projectDir;
  }

  log(
    'error',
    'Project dir does not exist, are you sure you ran metapak inside a Node project?'
  );
  exit(1);
});
