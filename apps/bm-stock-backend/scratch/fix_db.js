const { execFileSync } = require('child_process');

function runPsql(sql) {
  return execFileSync('docker', ['exec', '-i', 'bm-stock-postgres', 'psql', '-U', 'postgresbmstock', '-d', 'gelagle-stock-ims', '-c', sql], { encoding: 'utf-8' });
}

console.log("=== 1. SYNCING USERS COMPANYID WITH EMPLOYEES COMPANYID ===");
const syncSql = `
UPDATE users u
SET "companyId" = e."companyId"
FROM employees e
WHERE e."userId" = u.id AND e."companyId" IS NOT NULL AND u."companyId" != e."companyId";
`;
console.log(runPsql(syncSql));

console.log("=== 2. REMOVING FAKE ORPHAN COMPANIES ===");
const delSql = `
DELETE FROM companies
WHERE name LIKE '%''s Company'
  AND id NOT IN (SELECT DISTINCT "companyId" FROM users WHERE "companyId" IS NOT NULL)
  AND id NOT IN (SELECT DISTINCT "companyId" FROM employees WHERE "companyId" IS NOT NULL)
  AND id NOT IN (SELECT DISTINCT "companyId" FROM warehouses WHERE "companyId" IS NOT NULL)
  AND id NOT IN (SELECT DISTINCT "companyId" FROM shops WHERE "companyId" IS NOT NULL);
`;
console.log(runPsql(delSql));

console.log("=== 3. FLUSHING REDIS CACHE ===");
try {
  const redisRes = execFileSync('docker', ['exec', '-i', 'bm-stock-redis', 'redis-cli', 'FLUSHALL'], { encoding: 'utf-8' });
  console.log("Redis flush:", redisRes.trim());
} catch (e) {
  console.error("Redis flush error:", e.message);
}

console.log("=== 4. VERIFYING ALL EMPLOYEES ===");
const verifySql = `
SELECT e.id as emp_id, e.name as emp_name, e."companyId" as emp_company, 
       u.id as user_id, u.email, u.phone, u."companyId" as user_company, 
       c.name as user_company_name 
FROM employees e 
LEFT JOIN users u ON e."userId" = u.id 
LEFT JOIN companies c ON u."companyId" = c.id;
`;
console.log(runPsql(verifySql));
