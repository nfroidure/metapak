const YError = require('yerror');
const path = require('path');
const { autoService } = require('knifecycle');

module.exports = autoService(initResolveModule);

async function initResolveModule() {
  return function resolveModule(metapakModuleName) {
    try {
      return path.dirname(require.resolve(`${metapakModuleName}/package`));
    } catch (err) {
      throw YError.wrap(err, 'E_MODULE_NOT_FOUND', metapakModuleName);
    }
  };
}
