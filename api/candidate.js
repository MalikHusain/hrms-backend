import { Pool } from "pg";

// PostgreSQL connection (adjust credentials if needed)
const pool = new Pool({
  user: "postgres",       // your db username
  host: "localhost",      // or your db host
  database: "hrms",    // your database name
  password: "Malik",   // your db password
  port: 5432,
});

// Serverless handler
export default async function handler(req, res) {
  if (req.method === "GET") {
    // Fetch all candidates
    try {
      const result = await pool.query("SELECT * FROM candidates ORDER BY created_at DESC");
      res.status(200).json(result.rows);
    } catch (error) {
      console.error("Database query failed:", error);
      res.status(500).json({ error: "Database query failed" });
    }
  } else if (req.method === "POST") {
    // Add new candidate
    try {
      const { name, email, phone, position, department } = req.body;

      if (!name || !email || !phone || !position || !department) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const query = `
        INSERT INTO candidates (name, email, phone, position, department)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;

      const values = [name, email, phone, position, department];
      const result = await pool.query(query, values);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("Database insert failed:", error);
      res.status(500).json({ error: "Failed to add candidate" });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}