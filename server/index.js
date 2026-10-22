// Hackathon demo server - not the real backend. Talks to Postgres directly,
// one endpoint, no auth, no Redis, no queue. Plan.md has the real design.
import express from "express"
import cors from "cors"
import pg from "pg"

const pool = new pg.Pool({ database: "travelapp" })
const app = express()
app.use(cors())
app.use(express.json())

app.get("/api/gyms", async (req, res) => {
  const { rows } = await pool.query("SELECT id, name, lat, lng, rating, description FROM gyms")
  res.json(rows)
})

app.get("/api/gyms/:id/reviews", async (req, res) => {
  const { rows } = await pool.query(
    "SELECT id, author, rating, body, created_at FROM reviews WHERE gym_id = $1 ORDER BY created_at DESC",
    [req.params.id]
  )
  res.json(rows)
})

app.post("/api/gyms/:id/reviews", async (req, res) => {
  const { author, rating, body } = req.body
  const { rows } = await pool.query(
    "INSERT INTO reviews (gym_id, author, rating, body) VALUES ($1, $2, $3, $4) RETURNING id, author, rating, body, created_at",
    [req.params.id, author, rating, body]
  )
  res.status(201).json(rows[0])
})

app.listen(3001, () => console.log("Demo API listening on http://localhost:3001"))
