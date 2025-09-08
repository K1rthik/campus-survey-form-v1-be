// FormSubmission.js
const express = require('express');
const multer = require('multer');
const pool = require('../db'); // PG Pool
const router = express.Router();

/* ------------ Multer (memory) with limits & type filter ------------ */

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Allow JPEG/PNG (add 'image/webp' if you choose to support it)
  const allowed = ['image/jpeg', 'image/png'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', `Unsupported mimetype: ${file.mimetype}`));
};

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB per file
    files: 2,                  // selfie + signature
    fields: 50,
  },
  fileFilter,
});

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

// Accept TWO file fields: selfie and signature
router.post(
  '/add-info',
  upload.fields([
    { name: 'selfie', maxCount: 1 },
    { name: 'signature', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      // Text fields (from multipart)
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
        eventName,
        eventDate,
        visitorType,
        idNumber,
        feedback,
        signature: signatureBase64, // fallback if signature sent as base64
        formType,
      } = req.body;

      // Derive first/last name if needed
      const { firstName, lastName } = deriveNameParts({
        firstName: bodyFirstName,
        lastName: bodyLastName,
        name,
      });

      // Files parsed by multer
      const selfieFile    = req.files?.selfie?.[0] || null;
      const signatureFile = req.files?.signature?.[0] || null;

      // Buffers to persist (BYTEA in Postgres)
      const selfieBuffer = selfieFile ? selfieFile.buffer : null;

      // Signature: prefer uploaded file; else allow base64 fallback
      let signatureBuffer = null;
      if (signatureFile) {
        signatureBuffer = signatureFile.buffer;
      } else if (signatureBase64) {
        const base64Data = String(signatureBase64).replace(/^data:image\/\w+;base64,/, '');
        signatureBuffer = Buffer.from(base64Data, 'base64');
      }

      /* -------------- Validation -------------- */
      if (!firstName) {
        return res.status(400).json({ error: 'firstName is required.' });
      }
      if (!eventName || !visitorType) {
        return res.status(400).json({ error: 'eventName and visitorType are required.' });
      }
       if (!eventDate) {
        return res.status(400).json({ error: 'eventDate is required.' });
      }
      if (!selfieBuffer) {
        return res.status(400).json({ error: 'selfie image is required.' });
      }
      if (!signatureBuffer) {
        return res.status(400).json({ error: 'signature image is required.' });
      }

      /* -------------- Insert -------------- */
      const result = await pool.query(
        `INSERT INTO form_submissions (
          first_name, last_name, email, contact, gender,
          employee_status, employee_type, employee_id,
          event_name, event_date, visitor_type, id_number, feedback,
          selfie, signature, form_type
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
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

      return res.status(201).json({
        message: 'Form data submitted successfully!',
        data: result.rows[0],
      });
    } catch (error) {
      // Multer-specific errors (size/type/unexpected field)
      if (error instanceof multer.MulterError) {
        console.error('MulterError:', error);
        const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        return res.status(status).json({ error: `Upload error: ${error.code}` });
      }
      console.error('Error submitting form data:', error);
      return res.status(500).json({ error: 'Failed to submit form data.' });
    }
  }
);

module.exports = router;

// // FormSubmission.js
// const express = require('express');
// const multer = require('multer');
// const pool = require('../db'); // Import the database connection pool
// const router = express.Router();

// // Multer setup for file uploads. Use memory storage to get a buffer.
// const upload = multer({ storage: multer.memoryStorage() });

// // POST endpoint to handle form data and file uploads
// router.post('/add-info', upload.single('selfie'), async (req, res) => {
//   try {
//     const {
//       firstName, lastName, email, contact, gender,
//       employeeStatus, employeeType, employeeId,
//       eventName, visitorType, idNumber, feedback, signature, formType
//     } = req.body;

//     // Convert selfie file to a buffer (it's already in req.file.buffer with memory storage)
//     const selfieBuffer = req.file ? req.file.buffer : null;

//     // Convert signature Base64 string to a buffer
//     let signatureBuffer = null;
//     if (signature) {
//       const base64Data = signature.replace(/^data:image\/\w+;base64,/, '');
//       signatureBuffer = Buffer.from(base64Data, 'base64');
//     }

//     // Insert data into the database
//     const result = await pool.query(
//       `INSERT INTO form_submissions (
//         first_name, last_name, email, contact, gender,
//         employee_status, employee_type, employee_id,
//         event_name, visitor_type, id_number, feedback,
//         selfie, signature, form_Type
//       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
//       RETURNING *;`,
//       [
//         firstName, lastName, email, contact, gender,
//         employeeStatus, employeeType, employeeId,
//         eventName, visitorType, idNumber, feedback,
//         selfieBuffer, signatureBuffer, formType
//       ]
//     );

//     res.status(201).json({
//       message: 'Form data submitted successfully!',
//       data: result.rows[0]
//     });

//   } catch (error) {
//     console.error('Error submitting form data:', error);
//     res.status(500).json({ error: 'Failed to submit form data.' });
//   }
// });

// module.exports = router;