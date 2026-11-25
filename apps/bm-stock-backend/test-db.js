const { Client } = require('pg');
const c = new Client({ host: 'localhost', port: 5434, user: 'postgres', password: 'postgres', database: 'gelagle-stock-ims' });
c.connect()
  .then(() => c.query("SELECT count(*) as cnt FROM information_schema.tables WHERE table_schema = 'public'"))
  .then(r => console.log('Tables:', r.rows[0].cnt))
  .catch(e => console.error(e.message))
  .finally(() => c.end());
