/**
 * Employee Data Service
 * Secure operational data access (leave/payroll) via controlled tools.
 * Uses in-memory mock data for now; replace with DB calls in production.
 */

const auditLog = (action, payload) => {
  // In production, write to an audit collection / external log sink
  console.log(`[AUDIT] ${new Date().toISOString()} ${action}:`, payload);
};

function ensureEmployee(actorRole, employeeId) {
  if (actorRole !== "employee") {
    const err = new Error("Employee role required");
    err.status = 403;
    throw err;
  }
  if (!employeeId) {
    const err = new Error("Employee ID required");
    err.status = 400;
    throw err;
  }
}

// Simple rate-limit placeholder (per process memory)
const rateLimitMap = new Map();
function checkRateLimit(employeeId, limit = 20, windowMs = 60 * 1000) {
  const now = Date.now();
  const entry = rateLimitMap.get(employeeId) || { count: 0, ts: now };
  if (now - entry.ts > windowMs) {
    rateLimitMap.set(employeeId, { count: 1, ts: now });
    return;
  }
  if (entry.count >= limit) {
    const err = new Error("Rate limit exceeded");
    err.status = 429;
    throw err;
  }
  rateLimitMap.set(employeeId, { count: entry.count + 1, ts: entry.ts });
}

async function getLeaveBalance(employeeId, { actorRole }) {
  ensureEmployee(actorRole, employeeId);
  checkRateLimit(employeeId);

  // Mock data; replace with secure DB query (allowlisted)
  const data = {
    employeeId,
    annualLeave: 20,
    usedLeave: 5,
    remainingLeave: 15,
    sickLeave: 10,
    usedSickLeave: 2,
    remainingSickLeave: 8,
    lastUpdated: new Date().toISOString(),
  };

  auditLog("leave_balance_access", { employeeId, actorRole });
  return data;
}

module.exports = {
  getLeaveBalance,
};

