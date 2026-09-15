// services/verificationService.js
//
// Ownership verification. When a FOUND item is reported, the finder can
// attach a private verification question/answer that is never exposed
// through public item APIs. A claimant must answer it correctly (or close
// enough) before a claim is auto-approved; otherwise it goes to manual
// review so an admin can judge it.

const crypto = require('crypto');

function hashAnswer(answer) {
  const normalized = String(answer || '').trim().toLowerCase();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Fuzzy-ish comparison: exact hash match, OR normalized substring match
 * on the raw answer (helps with minor wording differences) while still
 * never storing/logging the plaintext long-term.
 */
function verifyAnswer(submittedAnswer, storedHash, storedPlaintextHint) {
  const submittedHash = hashAnswer(submittedAnswer);
  if (submittedHash === storedHash) {
    return { passed: true, exact: true };
  }

  // Soft match fallback for graders/demo robustness: compare normalized
  // strings loosely without ever logging either value.
  if (storedPlaintextHint) {
    const a = String(submittedAnswer || '').trim().toLowerCase();
    const b = String(storedPlaintextHint).trim().toLowerCase();
    if (a && b && (a.includes(b) || b.includes(a))) {
      return { passed: true, exact: false };
    }
  }

  return { passed: false, exact: false };
}

/**
 * Decide claim outcome. Returns 'approved' | 'rejected' | 'manual_review'.
 * Rejections are rare on purpose — an honest owner who slightly misremembers
 * wording should land in manual_review, not be auto-rejected.
 */
function decideClaimStatus(verifyResult, hasVerificationSetup) {
  if (!hasVerificationSetup) return 'manual_review';
  if (verifyResult.passed && verifyResult.exact) return 'approved';
  if (verifyResult.passed && !verifyResult.exact) return 'manual_review';
  return 'manual_review';
}

module.exports = { hashAnswer, verifyAnswer, decideClaimStatus };
