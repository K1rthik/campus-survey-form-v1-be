// db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: 'postgres',
    host: '172.30.6.12',
    database: 'Campus-Survey-Form',
    password: 'P@ssw0rd',
    port: 5000,
});

// Test the database connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Error acquiring client', err.stack);
  }
  console.log('Connected to PostgreSQL database!');
  release();
});

module.exports = pool;