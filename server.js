// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const FormSubmissionRoutes = require('./routes/FormSubmission');
const SecurityFormRoutes = require('./routes/SecurityForm');
const CampusFormRoutes = require('./routes/CampusForm');

const app = express();
const port = process.env.PORT || 5057;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Use the form submission routes
app.use('/api/form-submission', FormSubmissionRoutes);
app.use('/api/security-form', SecurityFormRoutes);
app.use('/api/campus-form', CampusFormRoutes);


app.listen(port, () => {
  console.log(`Server is running on port 172.30.6.7:${port}`);
});