# metapak
> Node modules authoring made easy.

## What's that?

`metapak` provides a set of tools to build your own meta npm packages easily.

A meta npm package takes advantage of npm
 [lifecycle scripts](https://docs.npmjs.com/misc/scripts)
 to allow you to manage several similar npm packages/NodeJS
 projects in a simple and versioned way.

Here is a [simple deck](https://slides.com/nfroidure/meta-npm-packages/live#/)
 introducing it.

## What is it good for?

Let's say you are the author of thousands of Node modules.
Now, imagine you want, for all of them:
- change your linter,
- change your license,
- change your CI provider,
- add a README template system,
- add a contributors guide,
- setup git hooks.

This could look like a developer nightmare, not with `metapak`.

## Features

Enable you to create a npm meta module you will be able to install
 on all you npm modules/NodeJS projects.
- amend all your npm modules `package.json` globally, in
 a composable way (shared dependencies, utility scripts etc...),
- add assets to all your projects without polluting you git
 history with insignificant changes,
- automatically install git hooks.

`metapak` can handle several meta packages so that you can compose
 them easily and keep them small and focused on one concern.

Zero config for your contributors, nothing to install globally.

## Usage

First create your own `metapak` module (you can look
 [at mine](https://github.com/nfroidure/metapak-nfroidure) to grasp its
 architecture).

You **must** name your module with the `metapak-` prefix in order to make
 it work.

Now, just define the states of all your Node modules:
```sh
mkdir src
mkdir src/_common

# Let's set the package.json of all your modules
# Note this has to be predictable function (ie: same run same result)
echo "
module.exports = (packageConf) => {
  // Looks like i am the contributor of all my modules ;)
  packageConf.author = 'Nicolas Froidure';

  // I mostly publish under MIT license, let's default to it
  packageConf.license = 'MIT';

  // Let's add my handy scripts
  packageConf.scripts = packageConf.scripts || {};
  packageConf.scripts.cli = 'env NODE_ENV=${NODE_ENV:-cli}';

  // And the MUST HAVE dependencies
  packageConf.dependencies = packageConf.dependencies || {};
  packageConf.dependencies.debug = '1.0.0';
  packageConf.dependencies.eslint = '4.0.0';

  return packageConf;
}" > src/_common/package.js

# Let's also add some common assets metapak will add/update for us
mkdir src/_common/assets
# Adding the license
wget -O src/_common/assets/LICENSE https://mit-license.org/license.txt
# Adding a git ignore file
# Note we replaced the dot of the file per _dot_
# This is due to a magic behavior of npm
# See: https://github.com/npm/npm/issues/15660
echo "node_modules" > src/_common/assets/_dot_gitignore

# And make some additions to them, like templating
echo "
module.exports = (file, packageConf) => {
  // Back to the good dot ;)
  if(file.name.startsWith('_dot_')) {
    file.name = file.name.replace('_dot_', '.');
  }
  // Simple templating of the LICENSE
  // There is no glob matching or templating system
  // in metapak to let you choose the ones you like
  if(file.name === 'LICENSE') {
    file.data = file.data.replace(
      /<copyright holders>/g,
      'Nicolas Froidure'
    );
    return file;
  }
  return file;
};
" > src/_common/assets.js

# Finally let's add my git hooks on it
echo "module.exports = (hooks, packageConf) => {
  hooks['pre-commit'] = hooks['pre-commit'] || [];
  hooks['pre-commit'].push('npm run test && npm run lint || exit 1');
  return hooks;
};
" > src/_common/hooks.js
```

Now publish your package to npm and install it in all
 your repositories development dependencies with metapak.

```
npm i --save-dev metapak metapak-nfroidure
```

That's it! There is a lot of things you can set on all your projects like
 CI scripts, linters, tests configuration etc...

You can also create specific configs and combine them. Let's say i work at
 Big Brother inc. and i want to add special behavior for the modules I create
 at work:

```sh
mkdir bigbrother

# Let's add a package.json template
echo "
module.exports = (packageConf) => {
  // Lets proudly claim i wort at BB inc.!
  packageConf.author = 'Nicolas Froidure (Big Brother inc.)';

  // Let's change the LICENSE
  packageConf.license = 'SEE LICENSE';

  // Let's avoid loosing my job :D
  packageConf.private = true;

  return packageConf;
}" > src/bigbrother/package.js

# Simply override the default license
mkdir src/bigbrother/assets
echo "
Copyright Big Brother inc. All rights reserved.
" > src/bigbrother/assets/LICENSE
```

Now, just create a new version of your package, publish it and add
 this specific behavior by adding the following property to your
 Big Brother's projects:
```
{
  "version": "1.0.0",
  "metapak": {
    configs: ["bigbrother"] // This map to the bigbrother folder
  }
}
```

Note that the `_common` folder config cannot be disabled. That said you can
  only create specific configs and have no common behavior set at all.
