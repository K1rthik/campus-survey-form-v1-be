// FormSubmission.js
const express = require('express');
const pool = require('../db');
const { encryptServer, decryptServer } = require('./encryptionUtils');
const router = express.Router();

// Add JSON body parser middleware with 50MB limit
router.use(express.json({ limit: '50mb' }));

/* -------------------- Helpers -------------------- */

// Derive first/last name if only "name" is provided
function deriveNameParts(body) {
  let { firstName, lastName, name } = body;

  firstName = firstName && String(firstName).trim();
  lastName  = lastName  && String(lastName).trim();

  if ((!firstName || !lastName) && name) {
    const parts = String(name).trim().split(/\s+/);
    if (!firstName) firstName = parts.shift() || '';
    if (!lastName)  lastName  = parts.join(' ') || '';
  }

  return {
    firstName: firstName || '',
    lastName: lastName || '',
  };
}

/* --------------------- Route --------------------- */

router.post('/add-info', async (req, res) => {
  try {
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

    // Text fields from decrypted data
    const {
      // Preferred individual fields
      firstName: bodyFirstName,
      lastName: bodyLastName,
      name, // optional combined name; used as fallback
      email,
      contact,
      gender,
      employeeStatus,
      employeeType,
      employeeId,
      selectionType, // NEW: Add selectionType extraction
      eventName,
      eventDate,
      visitorType,
      idNumber,
      feedback,
      formType,
      // Base64 encoded images
      selfie: selfieBase64,
      signature: signatureBase64,
    } = decryptedData;

    // Derive first/last name if needed
    const { firstName, lastName } = deriveNameParts({
      firstName: bodyFirstName,
      lastName: bodyLastName,
      name,
    });

    // Convert Base64 to Buffers
    let selfieBuffer = null;
    if (selfieBase64) {
      const base64Data = String(selfieBase64).replace(/^data:image\/\w+;base64,/, '');
      selfieBuffer = Buffer.from(base64Data, 'base64');
    }

    let signatureBuffer = null;
    if (signatureBase64) {
      const base64Data = String(signatureBase64).replace(/^data:image\/\w+;base64,/, '');
      signatureBuffer = Buffer.from(base64Data, 'base64');
    }

    /* -------------- Validation -------------- */
    if (!firstName) {
      const errorResponse = JSON.stringify({
        error: 'firstName is required.'
      });
      return res.status(400).json({ 
        envelope: encryptServer(errorResponse) 
      });
    }
    
    // NEW: Validate selectionType
    if (!selectionType) {
      const errorResponse = JSON.stringify({
        error: 'selectionType is required.'
      });
      return res.status(400).json({ 
        envelope: encryptServer(errorResponse) 
      });
    }

    // NEW: Validate selectionType values based on form type
    const validSelectionTypes = ['overall-experience', 'event-organization', 'entry-process', 
      'venue-infrastructure', 'seating-arrangements', 'food-refreshments',
      'hospitality-staff', 'audio-visual', 'cleanliness-hygiene', 
      'security-safety', 'others-suggestions','food-quality', 'menu-variety', 'hygiene-cleanliness', 
      'service-staff', 'waiting-time', 'kafe-app', 
      'item-availability', 'seating-ambience',];
    if (!validSelectionTypes.includes(selectionType)) {
      const errorResponse = JSON.stringify({
        error: 'Invalid selection type',
        validTypes: validSelectionTypes
      });
      return res.status(400).json({ 
        envelope: encryptServer(errorResponse) 
      });
    }

    if (!eventName || !visitorType) {
      const errorResponse = JSON.stringify({
        error: 'eventName and visitorType are required.'
      });
      return res.status(400).json({ 
        envelope: encryptServer(errorResponse) 
      });
    }
    if (!eventDate) {
      const errorResponse = JSON.stringify({
        error: 'eventDate is required.'
      });
      return res.status(400).json({ 
        envelope: encryptServer(errorResponse) 
      });
    }
    if (!selfieBuffer) {
      const errorResponse = JSON.stringify({
        error: 'selfie image is required.'
      });
      return res.status(400).json({ 
        envelope: encryptServer(errorResponse) 
      });
    }
    // if (!signatureBuffer) {
    //   const errorResponse = JSON.stringify({
    //     error: 'signature image is required.'
    //   });
    //   return res.status(400).json({ 
    //     envelope: encryptServer(errorResponse) 
    //   });
    // }

    /* -------------- Insert with selectionType -------------- */
    const result = await pool.query(
      `INSERT INTO form_submissions (
        first_name, last_name, email, contact, gender,
        employee_status, employee_type, employee_id,
        selection_type, event_name, event_date, visitor_type, id_number, feedback,
        selfie, signature, form_type
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
      RETURNING *;`,
      [
        firstName || null,
        lastName || null,
        email || null,
        contact || null,
        gender || null,
        employeeStatus || null,
        employeeType || null,
        employeeId || null,
        selectionType || null,  // NEW: Add selectionType parameter
        eventName || null,
        eventDate || null,
        visitorType || null,
        idNumber || null,
        feedback || null,
        selfieBuffer,
        signatureBuffer,
        formType || null,
      ]
    );

    // Encrypt success response
    const successResponse = JSON.stringify({
      message: 'Form data submitted successfully!',
      data: result.rows[0]
    });

    return res.status(201).json({
      envelope: encryptServer(successResponse)
    });
  } catch (error) {
    console.error('Error submitting form data:', error);
    
    // Encrypt error response
    const errorResponse = JSON.stringify({
      error: 'Failed to submit form data.',
      message: error.message
    });
    
    return res.status(500).json({
      envelope: encryptServer(errorResponse)
    });
  }
});

module.exports = router;