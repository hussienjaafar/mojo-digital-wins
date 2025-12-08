/**
 * PII Masking Utilities
 * Provides role-based masking for sensitive donor information
 */

/**
 * Mask an email address (show first 2 chars + domain)
 */
export function maskEmail(email: string | null): string {
  if (!email) return '***@***.***';
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return '***@***.***';
  
  const maskedLocal = localPart.length > 2 
    ? localPart.slice(0, 2) + '***'
    : '***';
  
  return `${maskedLocal}@${domain}`;
}

/**
 * Mask a name (show first initial only)
 */
export function maskName(name: string | null): string {
  if (!name || name.trim() === '') return '***';
  
  const parts = name.trim().split(' ');
  return parts.map(part => part.charAt(0) + '***').join(' ');
}

/**
 * Mask a phone number (show last 4 digits)
 */
export function maskPhone(phone: string | null): string {
  if (!phone) return '***-***-****';
  
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '***-***-****';
  
  return `***-***-${digits.slice(-4)}`;
}

/**
 * Mask an address
 */
export function maskAddress(address: string | null): string {
  if (!address) return '[Address Hidden]';
  return '*** [Address Hidden]';
}

/**
 * Mask a city/state (show state only)
 */
export function maskLocation(city: string | null, state: string | null): string {
  if (!state) return '[Location Hidden]';
  return `***, ${state}`;
}

/**
 * Donor info structure for masking
 */
export interface DonorInfo {
  donor_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  donor_email?: string | null;
  phone?: string | null;
  addr1?: string | null;
  city?: string | null;
  state?: string | null;
}

/**
 * Mask all PII fields in a donor record
 */
export function maskDonorInfo<T extends DonorInfo>(donor: T, shouldMask: boolean): T {
  if (!shouldMask) return donor;
  
  return {
    ...donor,
    donor_name: maskName(donor.donor_name),
    first_name: donor.first_name ? maskName(donor.first_name).split(' ')[0] : null,
    last_name: donor.last_name ? maskName(donor.last_name).split(' ')[0] : null,
    donor_email: maskEmail(donor.donor_email),
    phone: maskPhone(donor.phone),
    addr1: maskAddress(donor.addr1),
    city: donor.city ? '***' : null,
  };
}

/**
 * Hook-friendly masking function that checks user's PII access
 */
export function createPIIMasker(maskPII: boolean) {
  return <T extends DonorInfo>(records: T[]): T[] => {
    if (!maskPII) return records;
    return records.map(record => maskDonorInfo(record, true));
  };
}
