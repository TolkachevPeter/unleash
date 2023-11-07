// export module version
require('pkginfo')(module, 'version');
const appVersion = process.env.APP_VERSION;

let { version } = module.exports;

if (appVersion) {
    version = version + '.' + appVersion;
}

export default version;
module.exports = version;
