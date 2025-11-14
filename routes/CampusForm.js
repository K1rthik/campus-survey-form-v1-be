const express = require('express');
const router = express.Router();
const pool = require('../db');
const { encryptServer, decryptServer } = require('./encryptionUtils');

// Add JSON body parser middleware with 50MB limit
router.use(express.json({ limit: '50mb' }));

// POST endpoint for campus feedback
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
      // Campus form data
      selectionType, eventName, name, mobileNumber, userType, staffId, feedback, visitDate,
      // Base64 encoded data
      signature, selfieImage
    } = decryptedData;
 
    // Validate required fields
    if (!contact || !selectionType || !eventName || !name || !mobileNumber || !userType || !feedback || !signature || !visitDate) {
      const errorResponse = JSON.stringify({
        error: 'Required fields missing',
        required: ['contact', 'selectionType', 'eventName', 'name', 'mobileNumber', 'userType', 'feedback', 'signature', 'visitDate']
      });
      return res.status(400).json({ 
        envelope: encryptServer(errorResponse) 
      });
    }

    // Validate selectionType
    const validSelectionTypes = ['event', 'others', 'feedback', 'new idea', 'escalation'];
    if (!validSelectionTypes.includes(selectionType)) {
      const errorResponse = JSON.stringify({
        error: 'Invalid selection type',
        validTypes: validSelectionTypes
      });
      return res.status(400).json({ 
        envelope: encryptServer(errorResponse) 
      });
    }
 
    // Validate staff ID if user type is Staff
    if (userType === 'Staff' && !staffId) {
      const errorResponse = JSON.stringify({
        error: 'Staff ID is required for staff members'
      });
      return res.status(400).json({ 
        envelope: encryptServer(errorResponse) 
      });
    }
 
    // Validate selfie image
    if (!selfieImage) {
      const errorResponse = JSON.stringify({
        error: 'Selfie image is required'
      });
      return res.status(400).json({ 
        envelope: encryptServer(errorResponse) 
      });
    }
 
    // Parse and validate date format (dd/mm/yyyy)
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const dateMatch = visitDate.match(dateRegex);
   
    if (!dateMatch) {
      const errorResponse = JSON.stringify({
        error: 'visitDate must be in dd/mm/yyyy format'
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
        error: 'visitDate must be within the past 7 days including today'
      });
      return res.status(400).json({ 
        envelope: encryptServer(errorResponse) 
      });
    }
 
    // Convert base64 signature to buffer
    const signatureBase64 = signature.replace(/^data:image\/[a-z]+;base64,/, '');
    const signatureBuffer = Buffer.from(signatureBase64, 'base64');

    // Convert base64 selfie image to buffer
    const selfieBase64 = selfieImage.replace(/^data:image\/[a-z]+;base64,/, '');
    const selfieBuffer = Buffer.from(selfieBase64, 'base64');
 
    // Insert ALL data into database including selectionType
    const insertQuery = `
      INSERT INTO campus_feedback
      (first_name, last_name, gender, email, contact, employee_id, employee_type, employee_status,
       selection_type, event_name, name, mobile_number, user_type, staff_id, selfie_image, feedback, signature, visit_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
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
      name,
      mobileNumber,
      userType,
      userType === 'Staff' ? staffId : null,
      selfieBuffer,
      feedback,
      signatureBuffer,
      visitDate
    ]);
 
    await client.query('COMMIT');

    // Encrypt success response
    const successResponse = JSON.stringify({
      message: 'Complete feedback data saved successfully!',
      id: result.rows[0].id,
      timestamp: result.rows[0].created_at
    });
 
    res.status(201).json({
      envelope: encryptServer(successResponse)
    });
 
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error saving complete feedback data:', error);
    
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