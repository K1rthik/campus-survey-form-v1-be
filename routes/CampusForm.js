const express = require('express');
const router = express.Router();
const multer = require('multer');
const pool = require('../db');
// PostgreSQL connection pool
 
// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});
 
// POST endpoint for campus feedback - stores ALL form data
router.post('/add-info', upload.single('selfieImage'), async (req, res) => {
  const client = await pool.connect();
 
  try {
    await client.query('BEGIN');
   
    const {
      // Domain landing form data
      firstName, lastName, gender, email, contact, employeeId, employeeType,
      // Campus form data  
      eventName, name, mobileNumber, userType, staffId, feedback, signature
    } = req.body;
   
    // Validate required fields
    if (!contact || !eventName || !name || !mobileNumber || !userType || !feedback || !signature) {
      return res.status(400).json({
        error: 'Required fields missing',
        required: ['contact', 'eventName', 'name', 'mobileNumber', 'userType', 'feedback', 'signature']
      });
    }
 
    // Validate staff ID if user type is Staff
    if (userType === 'Staff' && !staffId) {
      return res.status(400).json({ error: 'Staff ID is required for staff members' });
    }
 
    // Validate selfie image
    if (!req.file) {
      return res.status(400).json({ error: 'Selfie image is required' });
    }
 
    // Convert base64 signature to buffer
    const signatureBase64 = signature.replace(/^data:image\/[a-z]+;base64,/, '');
    const signatureBuffer = Buffer.from(signatureBase64, 'base64');
 
    // Insert ALL data into database
    const insertQuery = `
      INSERT INTO campus_feedback
      (first_name, last_name, gender, email, contact, employee_id, employee_type,
       event_name, name, mobile_number, user_type, staff_id, selfie_image, feedback, signature)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
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
      eventName,                // Campus form data
      name,                     // Campus form data
      mobileNumber,             // Campus form data
      userType,                 // Campus form data
      userType === 'Staff' ? staffId : null, // Campus form data
      req.file.buffer,          // Selfie image buffer
      feedback,                 // Campus form data
      signatureBuffer           // Signature buffer
    ]);
 
    await client.query('COMMIT');
 
    res.status(201).json({
      message: 'Complete feedback data saved successfully!',
      id: result.rows[0].id,
      timestamp: result.rows[0].created_at
    });
 
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving complete feedback data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  } finally {
    client.release();
  }
});
 
module.exports = router;
 
 