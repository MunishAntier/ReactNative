import { parsePhoneNumberFromString } from 'libphonenumber-js';
import * as Contacts from 'expo-contacts';

/**
 * Normalizes a single phone number to E.164 format and removes the '+' prefix.
 * Default region is 'IN' (India) as per the prompt example.
 */
export const normalizePhoneNumber = (number: string, region: string = 'IN'): string | null => {
    try {
        const parsed = parsePhoneNumberFromString(number, region as any);
        if (parsed?.isValid()) {
            // Backend expects the number without the '+' prefix
            return parsed.number.replace('+', '');
        }
    } catch (error) {
        console.warn(`[contactUtils] Failed to parse number ${number}:`, error);
    }
    return null;
};

/**
 * Extracts and normalizes all phone numbers from a list of contacts.
 * Returns a unique array of normalized numbers.
 */
export const getNormalizedNumbers = (contacts: Contacts.Contact[]): string[] => {
    const numbers = new Set<string>();

    contacts.forEach(contact => {
        contact.phoneNumbers?.forEach(p => {
            if (p.number) {
                const normalized = normalizePhoneNumber(p.number);
                if (normalized) {
                    numbers.add(normalized);
                }
            }
        });
    });

    return Array.from(numbers);
};

/**
 * Checks if a contact has any of the matched numbers.
 */
export const isAppUser = (contact: Contacts.Contact, matchedNumbers: Set<string>): boolean => {
    if (!contact.phoneNumbers) return false;

    for (const p of contact.phoneNumbers) {
        if (p.number) {
            const normalized = normalizePhoneNumber(p.number);
            if (normalized && matchedNumbers.has(normalized)) {
                return true;
            }
        }
    }
    return false;
};
