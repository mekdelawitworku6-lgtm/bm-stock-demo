SELECT "userRole", COUNT(*) FROM admin_audit_logs
WHERE "userRole" IS NOT NULL
GROUP BY "userRole"
ORDER BY COUNT(*) DESC
LIMIT 15;
