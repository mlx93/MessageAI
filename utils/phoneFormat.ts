/**
 * Phone Number Formatting Utilities
 * 
 * Formats E.164 phone numbers for display
 */

/**
 * Format phone number for display
 * Converts E.164 format (+15555555555) to readable format
 * 
 * @param phoneNumber - Phone number in E.164 format (e.g., "+15555555555")
 * @returns Formatted phone number (e.g., "(555) 555-5555")
 */
export const formatPhoneNumber = (phoneNumber: string): string => {
  if (!phoneNumber) return '';
  
  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Handle US/Canada numbers (11 digits starting with 1)
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    const areaCode = cleaned.substring(1, 4);
    const prefix = cleaned.substring(4, 7);
    const lineNumber = cleaned.substring(7, 11);
    return `(${areaCode}) ${prefix}-${lineNumber}`;
  }
  
  // Handle US/Canada numbers (10 digits)
  if (cleaned.length === 10) {
    const areaCode = cleaned.substring(0, 3);
    const prefix = cleaned.substring(3, 6);
    const lineNumber = cleaned.substring(6, 10);
    return `(${areaCode}) ${prefix}-${lineNumber}`;
  }
  
  // Handle other lengths - try to format reasonably
  if (cleaned.length > 10) {
    // International number - show with country code
    const countryCode = cleaned.substring(0, cleaned.length - 10);
    const rest = cleaned.substring(cleaned.length - 10);
    const areaCode = rest.substring(0, 3);
    const prefix = rest.substring(3, 6);
    const lineNumber = rest.substring(6, 10);
    return `+${countryCode} (${areaCode}) ${prefix}-${lineNumber}`;
  }
  
  // If we can't format it nicely, just return the original
  return phoneNumber;
};

/**
 * Format phone number for display with fallback
 * Shows formatted number or empty string
 * 
 * @param phoneNumber - Phone number in E.164 format
 * @returns Formatted phone number or empty string
 */
export const formatPhoneNumberOrEmpty = (phoneNumber?: string | null): string => {
  if (!phoneNumber) return '';
  return formatPhoneNumber(phoneNumber);
};

