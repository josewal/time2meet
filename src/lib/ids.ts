import { customAlphabet } from "nanoid";

const URL_SAFE = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz";

export const eventId = customAlphabet(URL_SAFE, 22);
export const participantId = customAlphabet(URL_SAFE, 12);
export const adminToken = customAlphabet(URL_SAFE, 24);
