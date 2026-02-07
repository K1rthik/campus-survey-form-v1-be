const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Test the database connection
pool.connect()
  .then(client => {
    console.log("Connected to PostgreSQL database 🚀");
    client.release();
  })
  .catch(err => {
    console.error("Error connecting to PostgreSQL", err);
  });

module.exports = pool;
