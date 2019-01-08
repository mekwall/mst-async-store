module.exports = {
  '*.{ts,tsx}': [
    'tslint --fix',
    'prettier --parser typescript --write',
    'git add',
    'jest --bail --findRelatedTests',
  ],
  '*.{js,jsx}': ['tslint --fix', 'prettier --write', 'git add'],
  '*.{md,yaml,json}': ['prettier --write', 'git add'],
};
