# metapak
> Node modules authoring made easy.

## What's that?

`metapak` provides a set of tools to build your own meta npm package easily.

A meta npm package takes advantage of npm lifecycle scripts
 to allow you to manage several similar npm packages in a
 simple and versioned way.

Here is a [simple deck](https://slides.com/nfroidure/meta-npm-packages/live#/)
 introducing it.

## What is it good for?

Let's say you are the author of thousands of Node modules. Now, imagine you
 want, for all of them:
- change your linter,
- change your license,
- change your CI provider,
- add a README template system,
- add a contributors guide,
- setup git hooks.

This could look like a developer nightmare, not with `metapak`.

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
echo "node_modules" > src/_common/assets/.gitignore
wget -O src/_common/assets/LICENSE https://mit-license.org/license.txt

# And make some additions to them, like templating
echo "
module.exports = (file, packageConf) => {
  if(file.name !== 'LICENSE') {
    return file;
  }
  file.data = file.data.replace(/<copyright holders>/g, 'Nicolas Froidure');
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

Now publish your package to NPM and install it in all your repositories.

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
