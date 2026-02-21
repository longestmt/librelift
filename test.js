const db = {
  stores: {
    settings: [
      { key: 'theme', value: 'dark' },
      { key: 'githubPAT', value: 'ghp_1234567890' },
      { key: 'githubGistId', value: 'abcdefg' }
    ]
  }
};
if (db.stores && db.stores.settings) {
    db.stores.settings = db.stores.settings.filter(
        s => s.key !== 'githubPAT' && s.key !== 'githubGistId'
    );
}
console.log(JSON.stringify(db, null, 2));
