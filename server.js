// server.js
import express from "express";
import cors from "cors";
import pg from "pg";

const app = express();
app.use(cors());
app.use(express.json());

const pool = new pg.Pool({
  user: "postgres",
  host: "localhost",
  database: "hrms",
  password: "Malik",
  port: 5432,
});

// POST route to add candidate
app.post("/api/candidates", async (req, res) => {
  const { name, email, phone, position, department } = req.body;

  try {
    const result = await pool.query(
      "INSERT INTO candidates (name, email, phone, position, department) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [name, email, phone, position, department]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database insert failed" });
  }
});

app.listen(5000, () => console.log("Backend running on http://localhost:5000"));