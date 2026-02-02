// Validation utilities

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s-()]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

export function isValidPassword(password: string): boolean {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  return password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password);
}

export function isValidPostalCode(code: string): boolean {
  // Simple validation - can be enhanced based on locale
  return /^\d{5}(-\d{4})?$/.test(code);
}

export function isValidLicensePlate(plate: string): boolean {
  // Basic validation - can be enhanced based on region
  return plate.length >= 4 && plate.length <= 10 && /^[A-Z0-9-]+$/i.test(plate);
}

export function isValidWeight(kg: number): boolean {
  return kg > 0 && kg <= 50000; // Max 50 tons
}

export function isValidVolume(m3: number): boolean {
  return m3 > 0 && m3 <= 100; // Max 100 cubic meters
}

export function isValidCoordinates(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function validateOrderData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.pickupAddress) errors.push('Pickup address is required');
  if (!data.deliveryAddress) errors.push('Delivery address is required');
  if (!data.goodsType) errors.push('Goods type is required');
  if (!isValidWeight(data.weightKg)) errors.push('Invalid weight');
  if (!isValidVolume(data.volumeM3)) errors.push('Invalid volume');
  if (!isValidCoordinates(data.pickupLat, data.pickupLng)) errors.push('Invalid pickup coordinates');
  if (!isValidCoordinates(data.deliveryLat, data.deliveryLng)) errors.push('Invalid delivery coordinates');

  return {
    valid: errors.length === 0,
    errors,
  };
}
