const YError = require('yerror').default;
const path = require('path');
const { autoService } = require('knifecycle');

module.exports = autoService(initResolveModule);

async function initResolveModule({ PROJECT_DIR }) {
  return function resolveModule(metapakModuleName, packageConf) {
    try {
      // Cover the case a metapak plugin runs itself
      if (metapakModuleName === packageConf.name) {
        return path.dirname(require.resolve(`${PROJECT_DIR}/package`));
      }
      return path.dirname(require.resolve(`${metapakModuleName}/package`));
    } catch (err) {
      throw YError.wrap(err, 'E_MODULE_NOT_FOUND', metapakModuleName);
    }
  };
}
