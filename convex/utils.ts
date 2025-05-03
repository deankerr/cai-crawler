// Helper function (not exported)
function _extractFromObject(error: object): { message: string, additionalProps: Record<string, unknown> } {
  let message = ''
  let messageSourceKey: string | null = null // Track the key used for the message

  // Prioritize specific message properties
  if ('message' in error && typeof error.message === 'string' && error.message) {
    message = error.message
    messageSourceKey = 'message'
  }
  else if ('detail' in error && typeof error.detail === 'string' && error.detail) {
    message = error.detail
    messageSourceKey = 'detail'
  }
  else if (
    'data' in error
    && typeof error.data === 'object'
    && error.data !== null
    && 'message' in error.data
    && typeof error.data.message === 'string'
    && error.data.message
  ) {
    message = error.data.message
    // Message came from *within* 'data', so 'data' itself isn't the source key to exclude.
    messageSourceKey = null
  }

  // If no specific message found, use string conversion as fallback
  if (!message) {
    try {
      message = String(error)
      if (message === '[object Object]') {
        message = JSON.stringify(error)
      }
    }
    catch {
      message = 'Could not stringify error object.'
    }
    messageSourceKey = null // Fallback means no specific key was the source
  }

  // Build additionalProps selectively
  const additionalProps: Record<string, unknown> = {}
  for (const key in error) {
    // Ensure it's an own property
    if (Object.prototype.hasOwnProperty.call(error, key)) {
      // Exclude the key that was the direct source of the message
      if (key !== messageSourceKey) {
        additionalProps[key] = (error as any)[key] // Use type assertion for indexing
      }
    }
  }

  return { message, additionalProps }
}

/**
 * Extracts a meaningful error message from various error types.
 *
 * @param error - The unknown error input caught in a catch block.
 * @returns An object containing at least a `message` string, potentially with other error properties.
 */
export function getErrorMessage(
  error: unknown,
): { message: string, [key: string]: unknown } {
  let message = 'An unknown error occurred'
  let additionalProps: Record<string, unknown> = {}

  if (error instanceof Error) {
    message = error.message
    // For standard Errors, explicitly include only name and stack in additionalProps
    additionalProps = {
      ...(error.name && { name: error.name }),
      ...(error.stack && { stack: error.stack }),
    }
  }
  else if (typeof error === 'object' && error !== null) {
    const extracted = _extractFromObject(error)
    message = extracted.message
    additionalProps = extracted.additionalProps
  }
  else if (typeof error === 'string' && error) {
    // Handle non-empty strings
    message = error
  }
  else {
    // Final fallback for null, undefined, numbers, empty strings, etc.
    try {
      message = String(error)
    }
    catch {
      message = 'Failed to convert error to string.'
    }
  }

  // Final check to ensure message is never truly empty
  if (!message) {
    message = 'Error message was empty or could not be determined.'
  }

  return { message, ...additionalProps }
}
