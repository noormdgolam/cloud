// This host's MySQL server defaults new tables to MyISAM (no FK enforcement,
// no transactions, no row locking) instead of InnoDB. Prisma's MySQL connector
// doesn't expose a schema-level way to pin the storage engine, so this script
// converts every table in the database to InnoDB after each `prisma db push`
// / `prisma migrate deploy`. Idempotent — safe to run any number of times.
import "dotenv/config";
import mariadb from "mariadb";

async function main() {
  const conn = await mariadb.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const tables: { TABLE_NAME: string; ENGINE: string }[] = await conn.query(
    `SELECT TABLE_NAME, ENGINE FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND ENGINE IS NOT NULL AND ENGINE != 'InnoDB'`,
    [process.env.DB_NAME]
  );

  if (tables.length === 0) {
    console.log("All tables already InnoDB.");
    await conn.end();
    return;
  }

  for (const { TABLE_NAME, ENGINE } of tables) {
    console.log(`Converting ${TABLE_NAME} (${ENGINE} -> InnoDB)...`);
    await conn.query(`ALTER TABLE \`${TABLE_NAME}\` ENGINE=InnoDB`);
  }

  console.log(`Converted ${tables.length} table(s) to InnoDB.`);
  await conn.end();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
