const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Firebase's @firebase/auth package creates temporary directories during
// initialisation that Metro tries to watch but that are deleted immediately,
// producing an ENOENT crash.  Block-list the entire firebase/auth temp tree.
const firebaseAuthPkg = path.dirname(
  require.resolve('@firebase/auth/package.json'),
);
config.watchFolders = config.watchFolders ?? [];
config.resolver = config.resolver ?? {};
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  new RegExp(
    firebaseAuthPkg.replace(/[/\\]/g, '[/\\\\]') + '[/\\\\].*_tmp_.*',
  ),
];

module.exports = config;
