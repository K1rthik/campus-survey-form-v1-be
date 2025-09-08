const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../db');



// Configure multer for multiple file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit per file
    files: 10, // Maximum 10 files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// POST endpoint for security incidents
router.post('/add-info', upload.array('images', 10), async (req, res) => {
  const client = await pool.connect();
 
  try {
    await client.query('BEGIN');
   
    const {
      // Domain landing form data
      firstName, lastName, gender, email, contact, employeeId, employeeType, employeeStatus,
      // Security form data  
      eventName, eventDate, name, mobileNumber, staffId, verification, incidentReport, signature
    } = req.body;
   
    // Validate required fields (updated field names)
    if (!contact || !eventName || !eventDate || !name || !mobileNumber || !staffId ||
        !verification || !incidentReport || !signature) {
      return res.status(400).json({
        error: 'Required fields missing',
        required: ['contact', 'eventName', 'eventDate', 'name', 'mobileNumber', 'staffId',
                  'verification', 'incidentReport', 'signature']
      });
    }
 
    // Parse and validate date format (dd/mm/yyyy)
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const dateMatch = eventDate.match(dateRegex);
   
    if (!dateMatch) {
      return res.status(400).json({ error: 'eventDate must be in dd/mm/yyyy format' });
    }
 
    const [, day, month, year] = dateMatch;
    const parsedDate = new Date(year, month - 1, day); // month is 0-indexed in Date constructor
   
    // Validate if the date is valid
    if (parsedDate.getDate() != day || parsedDate.getMonth() != month - 1 || parsedDate.getFullYear() != year) {
      return res.status(400).json({ error: 'Invalid date provided' });
    }
 
    // Optional: enforce server-side 7-day range guard
    const today = new Date();
    const max = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const min = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
   
    if (parsedDate < min || parsedDate > max) {
      return res.status(400).json({ error: 'eventDate must be within the past 7 days including today' });
    }
 
    // Validate images
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'At least one incident image is required' });
    }
 
    // Convert base64 signature to buffer
    const signatureBase64 = signature.replace(/^data:image\/[a-z]+;base64,/, '');
    const signatureBuffer = Buffer.from(signatureBase64, 'base64');
 
    // Convert uploaded images to buffer array
    const imageBuffers = req.files.map(file => file.buffer);
 
    // Insert ALL data into database (updated field names and added event_date)
    const insertQuery = `
      INSERT INTO security_incidents
      (first_name, last_name, gender, email, contact, employee_id, employee_type, employee_status,
       event_name, event_date, name, mobile_number, staff_id, verification, incident_report,
       incident_images, signature)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id, created_at
    `;
 
    const result = await client.query(insertQuery, [
      firstName || null,        // Domain data
      lastName || null,         // Domain data
      gender || null,           // Domain data
      email || null,            // Domain data
      contact,                  // Domain data
      employeeId || null,       // Domain data
      employeeType || null,     // Domain data
      employeeStatus || null,   // Domain data
      eventName,                // Changed from employeeName to eventName
      eventDate,                // New field: store as dd/mm/yyyy string
      name,                     // Security form data
      mobileNumber,             // Security form data
      staffId,                  // Security form data
      verification,             // Security form data
      incidentReport,           // Security form data
      imageBuffers,             // Multiple images array
      signatureBuffer           // Signature buffer
    ]);
 
    await client.query('COMMIT');
 
    res.status(201).json({
      message: 'Security incident report submitted successfully!',
      incidentId: result.rows[0].id,
      timestamp: result.rows[0].created_at
    });
 
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving security incident:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  } finally {
    client.release();
  }
});

module.exports = router;
