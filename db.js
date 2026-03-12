// db.js
import pg from "pg";

const { Pool } = pg;

const pool = new Pool({
  user:     "postgres",
  host:     "localhost",
  database: "hrms",
  password: "Malik",
  port:     5432,
});

pool.connect((err) => {
  if (err) console.log("DB connection error:", err);
  else console.log("PostgreSQL Connected ✅");
});

export default pool;
