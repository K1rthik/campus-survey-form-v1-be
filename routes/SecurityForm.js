
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { encryptServer, decryptServer } = require('./encryptionUtils');

// Add JSON body parser middleware with 50MB limit
router.use(express.json({ limit: '50mb' }));

// POST endpoint for security incidents
router.post('/add-info', async (req, res) => {
  const client = await pool.connect();
 
  try {
    await client.query('BEGIN');
   
    // Decrypt the envelope
    const { envelope } = req.body;
    
    if (!envelope) {
      const errorResponse = JSON.stringify({
        error: 'Missing encrypted envelope',
        required: ['envelope']
      });
      return res.status(400).json({ 
        envelope: encryptServer(errorResponse) 
      });
    }

    // Decrypt and parse the payload
    let decryptedData;
    try {
      const decryptedString = decryptServer(envelope);
      decryptedData = JSON.parse(decryptedString);
    } catch (decryptError) {
      console.error('Decryption error:', decryptError);
      const errorResponse = JSON.stringify({
        error: 'Failed to decrypt request data',
        message: decryptError.message
      });
      return res.status(400).json({ 
        envelope: encryptServer(errorResponse) 
      });
    }

    const {
      // Domain landing form data
      firstName, lastName, gender, email, contact, employeeId, employeeType, employeeStatus,
      // Security form data  
      selectionType, eventName, eventDate, name, mobileNumber, staffId, verification, incidentReport,
      // Base64 encoded data
      images
    } = decryptedData;
   
    // Validate required fields
    if (!contact || !selectionType || !eventName || !eventDate || !name || !mobileNumber || !staffId ||
        !verification || !incidentReport) {
      const errorResponse = JSON.stringify({
        error: 'Required fields missing',
        required: ['contact', 'selectionType', 'eventName', 'eventDate', 'name', 'mobileNumber', 'staffId',
                  'verification', 'incidentReport']
      });
      return res.status(400).json({ 
        envelope: encryptServer(errorResponse) 
      });
    }

    // Validate selectionType
    const validSelectionTypes = ['event', 'students', 'employees', 'campus', 'others-suggestions'];
    if (!validSelectionTypes.includes(selectionType)) {
      const errorResponse = JSON.stringify({
        error: 'Invalid selection type',
        validTypes: validSelectionTypes
      });
      return res.status(400).json({ 
        envelope: encryptServer(errorResponse) 
      });
    }
 
    // Parse and validate date format (dd/mm/yyyy)
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const dateMatch = eventDate.match(dateRegex);
   
    if (!dateMatch) {
      const errorResponse = JSON.stringify({
        error: 'eventDate must be in dd/mm/yyyy format'
      });
      return res.status(400).json({ 
        envelope: encryptServer(errorResponse) 
      });
    }
 
    const [, day, month, year] = dateMatch;
    const parsedDate = new Date(year, month - 1, day);
   
    // Validate if the date is valid
    if (parsedDate.getDate() != day || parsedDate.getMonth() != month - 1 || parsedDate.getFullYear() != year) {
      const errorResponse = JSON.stringify({
        error: 'Invalid date provided'
      });
      return res.status(400).json({ 
        envelope: encryptServer(errorResponse) 
      });
    }
 
    // Enforce server-side 7-day range guard
    const today = new Date();
    const max = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const min = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
   
    if (parsedDate < min || parsedDate > max) {
      const errorResponse = JSON.stringify({
        error: 'eventDate must be within the past 7 days including today'
      });
      return res.status(400).json({ 
        envelope: encryptServer(errorResponse) 
      });
    }
 
    // Validate images
    if (!images || !Array.isArray(images) || images.length === 0) {
      const errorResponse = JSON.stringify({
        error: 'At least one incident image is required'
      });
      return res.status(400).json({ 
        envelope: encryptServer(errorResponse) 
      });
    }
 
    // Convert base64 images to buffer array
    const imageBuffers = images.map(imageBase64 => {
      const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, '');
      return Buffer.from(base64Data, 'base64');
    });
 
    // Insert ALL data into database including selectionType (without signature)
    const insertQuery = `
      INSERT INTO security_incidents
      (first_name, last_name, gender, email, contact, employee_id, employee_type, employee_status,
       selection_type, event_name, event_date, name, mobile_number, staff_id, verification, incident_report,
       incident_images)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id, created_at
    `;
 
    const result = await client.query(insertQuery, [
      firstName || null,
      lastName || null,
      gender || null,
      email || null,
      contact,
      employeeId || null,
      employeeType || null,
      employeeStatus || null,
      selectionType,
      eventName,
      eventDate,
      name,
      mobileNumber,
      staffId,
      verification,
      incidentReport,
      imageBuffers
    ]);
 
    await client.query('COMMIT');

    // Encrypt success response
    const successResponse = JSON.stringify({
      message: 'Security incident report submitted successfully!',
      incidentId: result.rows[0].id,
      timestamp: result.rows[0].created_at
    });
 
    res.status(201).json({
      envelope: encryptServer(successResponse)
    });
 
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving security incident:', error);
    
    // Encrypt error response
    const errorResponse = JSON.stringify({
      error: 'Internal server error',
      message: error.message
    });
    
    res.status(500).json({
      envelope: encryptServer(errorResponse)
    });
  } finally {
    client.release();
  }
});

module.exports = router;