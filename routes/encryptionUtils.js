// encryptionUtils.js - Shared encryption utilities for client and server

// Shared secrets - EXACTLY 32 bytes for AES-256 and 16 bytes for IV
const ENCRYPTION_KEY = 'aBfGhIjKlMnOpQrStUvWxYz012345678'; // Exactly 32 characters = 32 bytes
const ENCRYPTION_IV = '1234567890123456'; // Exactly 16 characters = 16 bytes (128 bits)
const VERSION_HEADER = 'v:1,';

// ============================================================================
// SERVER-SIDE FUNCTIONS (Node.js with built-in crypto)
// ============================================================================

/**
 * Encrypts text using AES-256-CBC (Node.js)
 * @param {string} text - Plain text to encrypt
 * @returns {string} - Encrypted envelope string with version header
 */
function encryptServer(text) {
  const crypto = require('crypto');
  
  const cipher = crypto.createCipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'utf8'),
    Buffer.from(ENCRYPTION_IV, 'utf8')
  );
  
  let encrypted = cipher.update(text, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  return VERSION_HEADER + encrypted;
}

/**
 * Decrypts envelope using AES-256-CBC (Node.js)
 * @param {string} envelope - Encrypted envelope string with version header
 * @returns {string} - Decrypted plain text
 */
function decryptServer(envelope) {
  const crypto = require('crypto');
  
  // Remove version header
  if (!envelope.startsWith(VERSION_HEADER)) {
    throw new Error('Invalid envelope format: missing version header');
  }
  
  const ciphertext = envelope.substring(VERSION_HEADER.length);
  
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(ENCRYPTION_KEY, 'utf8'),
    Buffer.from(ENCRYPTION_IV, 'utf8')
  );
  
  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// ============================================================================
// CLIENT-SIDE FUNCTIONS (Browser with crypto-js)
// ============================================================================

/**
 * Encrypts data object using AES-256-CBC (Browser)
 * @param {Object} dataObject - JavaScript object to encrypt
 * @returns {string} - Encrypted envelope string with version header
 */
function encryptClient(dataObject) {
  // This function is designed to be used in the browser with crypto-js
  // Import crypto-js in your React component:
  // import CryptoJS from 'crypto-js';
  
  if (typeof window === 'undefined') {
    throw new Error('encryptClient can only be used in browser environment');
  }
  
  const CryptoJS = window.CryptoJS || require('crypto-js');
  
  const jsonString = JSON.stringify(dataObject);
  
  const key = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY);
  const iv = CryptoJS.enc.Utf8.parse(ENCRYPTION_IV);
  
  const encrypted = CryptoJS.AES.encrypt(jsonString, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  
  return VERSION_HEADER + encrypted.toString();
}

/**
 * Decrypts envelope using AES-256-CBC (Browser)
 * @param {string} envelope - Encrypted envelope string with version header
 * @returns {Object} - Decrypted JavaScript object
 */
function decryptClient(envelope) {
  // This function is designed to be used in the browser with crypto-js
  // Import crypto-js in your React component:
  // import CryptoJS from 'crypto-js';
  
  if (typeof window === 'undefined') {
    throw new Error('decryptClient can only be used in browser environment');
  }
  
  const CryptoJS = window.CryptoJS || require('crypto-js');
  
  // Remove version header
  if (!envelope.startsWith(VERSION_HEADER)) {
    throw new Error('Invalid envelope format: missing version header');
  }
  
  const ciphertext = envelope.substring(VERSION_HEADER.length);
  
  const key = CryptoJS.enc.Utf8.parse(ENCRYPTION_KEY);
  const iv = CryptoJS.enc.Utf8.parse(ENCRYPTION_IV);
  
  const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
    iv: iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7
  });
  
  const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
  return JSON.parse(jsonString);
}

// ============================================================================
// EXPORTS
// ============================================================================

// For Node.js (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    encryptServer,
    decryptServer,
    encryptClient,
    decryptClient
  };
}

// For ES6 modules
if (typeof exports !== 'undefined') {
  exports.encryptServer = encryptServer;
  exports.decryptServer = decryptServer;
  exports.encryptClient = encryptClient;
  exports.decryptClient = decryptClient;
}
// encryptionUtils.js - Shared encryption utilities for client and server
// Production version with environment variable support

// const VERSION_HEADER = 'v:1,';

// // ============================================================================
// // ENVIRONMENT VARIABLE CONFIGURATION
// // ============================================================================

// /**
//  * Gets encryption configuration from environment variables
//  * @param {boolean} isServer - Whether running on server (Node.js) or client (Browser)
//  * @returns {Object} - { key, iv }
//  */
// function getEncryptionConfig(isServer) {
//   let ENCRYPTION_KEY, ENCRYPTION_IV;
  
//   if (isServer) {
//     // SERVER-SIDE: Read from process.env (loaded via dotenv or PM2/systemd)
//     ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
//     ENCRYPTION_IV = process.env.ENCRYPTION_IV;
    
//     if (!ENCRYPTION_KEY || !ENCRYPTION_IV) {
//       throw new Error(
//         'CRITICAL: ENCRYPTION_KEY and ENCRYPTION_IV must be set in environment variables. ' +
//         'Server cannot start without encryption secrets.'
//       );
//     }
    
//     // Validate key lengths for AES-256-CBC
//     if (ENCRYPTION_KEY.length !== 32) {
//       throw new Error(`ENCRYPTION_KEY must be exactly 32 bytes. Current length: ${ENCRYPTION_KEY.length}`);
//     }
    
//     if (ENCRYPTION_IV.length !== 16) {
//       throw new Error(`ENCRYPTION_IV must be exactly 16 bytes. Current length: ${ENCRYPTION_IV.length}`);
//     }
    
//   } else {
//     // CLIENT-SIDE: Read from Vite/CRA build-time environment variables
//     // These are baked into the production bundle at build time
//     ENCRYPTION_KEY = import.meta.env.VITE_ENCRYPTION_KEY || process.env.REACT_APP_ENCRYPTION_KEY;
//     ENCRYPTION_IV = import.meta.env.VITE_ENCRYPTION_IV || process.env.REACT_APP_ENCRYPTION_IV;
    
//     if (!ENCRYPTION_KEY || !ENCRYPTION_IV) {
//       throw new Error(
//         'CRITICAL: VITE_ENCRYPTION_KEY and VITE_ENCRYPTION_IV must be set during build. ' +
//         'Client cannot encrypt/decrypt without secrets.'
//       );
//     }
    
//     // Validate key lengths
//     if (ENCRYPTION_KEY.length !== 32 || ENCRYPTION_IV.length !== 16) {
//       throw new Error('Invalid encryption key/IV lengths');
//     }
//   }
  
//   return { key: ENCRYPTION_KEY, iv: ENCRYPTION_IV };
// }

// // ============================================================================
// // SERVER-SIDE FUNCTIONS (Node.js with built-in crypto)
// // ============================================================================

// /**
//  * Encrypts text using AES-256-CBC (Node.js)
//  * @param {string} text - Plain text to encrypt
//  * @returns {string} - Encrypted envelope string with version header
//  */
// function encryptServer(text) {
//   const crypto = require('crypto');
//   const { key, iv } = getEncryptionConfig(true);
  
//   const cipher = crypto.createCipheriv(
//     'aes-256-cbc',
//     Buffer.from(key, 'utf8'),
//     Buffer.from(iv, 'utf8')
//   );
  
//   let encrypted = cipher.update(text, 'utf8', 'base64');
//   encrypted += cipher.final('base64');
  
//   return VERSION_HEADER + encrypted;
// }

// /**
//  * Decrypts envelope using AES-256-CBC (Node.js)
//  * @param {string} envelope - Encrypted envelope string with version header
//  * @returns {string} - Decrypted plain text
//  */
// function decryptServer(envelope) {
//   const crypto = require('crypto');
//   const { key, iv } = getEncryptionConfig(true);
  
//   // Remove version header
//   if (!envelope.startsWith(VERSION_HEADER)) {
//     throw new Error('Invalid envelope format: missing version header');
//   }
  
//   const ciphertext = envelope.substring(VERSION_HEADER.length);
  
//   const decipher = crypto.createDecipheriv(
//     'aes-256-cbc',
//     Buffer.from(key, 'utf8'),
//     Buffer.from(iv, 'utf8')
//   );
  
//   let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
//   decrypted += decipher.final('utf8');
  
//   return decrypted;
// }

// // ============================================================================
// // CLIENT-SIDE FUNCTIONS (Browser with crypto-js)
// // ============================================================================

// /**
//  * Encrypts data object using AES-256-CBC (Browser)
//  * @param {Object} dataObject - JavaScript object to encrypt
//  * @returns {string} - Encrypted envelope string with version header
//  */
// function encryptClient(dataObject) {
//   if (typeof window === 'undefined') {
//     throw new Error('encryptClient can only be used in browser environment');
//   }
  
//   // Dynamic import handling for different module systems
//   const CryptoJS = window.CryptoJS || require('crypto-js');
//   const { key, iv } = getEncryptionConfig(false);
  
//   const jsonString = JSON.stringify(dataObject);
  
//   const cryptoKey = CryptoJS.enc.Utf8.parse(key);
//   const cryptoIv = CryptoJS.enc.Utf8.parse(iv);
  
//   const encrypted = CryptoJS.AES.encrypt(jsonString, cryptoKey, {
//     iv: cryptoIv,
//     mode: CryptoJS.mode.CBC,
//     padding: CryptoJS.pad.Pkcs7
//   });
  
//   return VERSION_HEADER + encrypted.toString();
// }

// /**
//  * Decrypts envelope using AES-256-CBC (Browser)
//  * @param {string} envelope - Encrypted envelope string with version header
//  * @returns {Object} - Decrypted JavaScript object
//  */
// function decryptClient(envelope) {
//   if (typeof window === 'undefined') {
//     throw new Error('decryptClient can only be used in browser environment');
//   }
  
//   const CryptoJS = window.CryptoJS || require('crypto-js');
//   const { key, iv } = getEncryptionConfig(false);
  
//   // Remove version header
//   if (!envelope.startsWith(VERSION_HEADER)) {
//     throw new Error('Invalid envelope format: missing version header');
//   }
  
//   const ciphertext = envelope.substring(VERSION_HEADER.length);
  
//   const cryptoKey = CryptoJS.enc.Utf8.parse(key);
//   const cryptoIv = CryptoJS.enc.Utf8.parse(iv);
  
//   const decrypted = CryptoJS.AES.decrypt(ciphertext, cryptoKey, {
//     iv: cryptoIv,
//     mode: CryptoJS.mode.CBC,
//     padding: CryptoJS.pad.Pkcs7
//   });
  
//   const jsonString = decrypted.toString(CryptoJS.enc.Utf8);
//   return JSON.parse(jsonString);
// }

// // ============================================================================
// // EXPORTS
// // ============================================================================

// // For Node.js (CommonJS)
// if (typeof module !== 'undefined' && module.exports) {
//   module.exports = {
//     encryptServer,
//     decryptServer,
//     encryptClient,
//     decryptClient
//   };
// }

// // For ES6 modules
// if (typeof exports !== 'undefined') {
//   exports.encryptServer = encryptServer;
//   exports.decryptServer = decryptServer;
//   exports.encryptClient = encryptClient;
//   exports.decryptClient = decryptClient;
// }   n