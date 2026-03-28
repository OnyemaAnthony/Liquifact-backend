/**
 * RFC 7807 (Problem Details for HTTP APIs) Formatter.
 * Takes error data and formats it into a standard JSON object.
 *
 * @param {Object} options - Problem detail options.
 * @param {string} [options.type='about:blank'] - Problem type URI.
 * @param {string} [options.title='An unexpected error occurred'] - Human-readable title.
 * @param {number} [options.status=500] - HTTP status code.
 * @param {string} [options.detail] - Detailed message.
 * @param {string} [options.instance] - Request-specific URI.
 * @param {string} [options.stack] - Optional stack trace.
 * @param {boolean} [options.isProduction] - Whether production redaction is enabled.
 * @returns {Object} RFC 7807 style payload.
 */
function formatProblemDetails(options = {}) {
  const {
    type = 'about:blank',
    title = 'An unexpected error occurred',
    status = 500,
    detail,
    instance,
    stack,
    isProduction = process.env.NODE_ENV === 'production',
  } = options;

  const problem = {
    type,
    title,
    status,
    detail,
    instance,
  };

  // Only include stack trace if NOT in production for security reasons
  if (!isProduction && stack) {
    problem.stack = stack;
  }

  return problem;
}

module.exports = formatProblemDetails;
