import { GoogleGenAI } from '@google/genai';
import { getActiveKycScannerApi } from '../models/kycScannerApiModel.js';

const ID_SCAN_RESPONSE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    fullName: {
      type: 'string',
      description: 'Full legal name printed on the identity document.',
    },
    email: {
      type: 'string',
      description: 'Email address if visible on the document; otherwise an empty string.',
    },
    phone: {
      type: 'string',
      description: 'Phone or mobile number if visible on the document; otherwise an empty string.',
    },
    nationality: {
      type: 'string',
      description: 'Country of origin or nationality shown on the document. Empty if unknown.',
    },
    birthDate: {
      type: 'string',
      description: 'Date of birth in MM/DD/YYYY format. Empty if not visible.',
    },
    idType: {
      type: 'string',
      enum: ['Passport', 'UMID', "Driver's License", 'Other'],
      description:
        'Government ID category. Use Driver\'s License for LTO/professional/non-professional licenses. Use UMID for Philsys/UMID/national ID cards.',
    },
    idNumber: {
      type: 'string',
      description: 'ID or document number.',
    },
    idExpiry: {
      type: 'string',
      description: 'Expiry date in MM/DD/YYYY format. Empty if not visible.',
    },
  },
  required: ['fullName', 'idType', 'idNumber', 'birthDate', 'idExpiry'],
};

const NATIONALITY_ALPHA3 = new Map([
  ['philippines', 'PHL'],
  ['philippine', 'PHL'],
  ['phl', 'PHL'],
  ['ph', 'PHL'],
  ['korea', 'KOR'],
  ['south korea', 'KOR'],
  ['republic of korea', 'KOR'],
  ['kor', 'KOR'],
  ['japan', 'JPN'],
  ['jpn', 'JPN'],
  ['china', 'CHN'],
  ['chn', 'CHN'],
  ['chinese', 'CHN'],
]);

function mmddyyyyToIso(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const slash = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(raw);
  if (slash) {
    const [, mm, dd, yyyy] = slash;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (iso) return raw;
  return '';
}

function normalizeNationality(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const upper = raw.toUpperCase();
  if (['PHL', 'KOR', 'JPN', 'CHN'].includes(upper)) return upper;
  const mapped = NATIONALITY_ALPHA3.get(raw.toLowerCase());
  return mapped ?? '';
}

function normalizeIdType(value) {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return 'Passport';
  if (raw.includes('passport')) return 'Passport';
  if (raw.includes('driver') || raw.includes('lto')) return "Driver's License";
  if (raw.includes('umid') || raw.includes('national') || raw.includes('philsys')) return 'UMID';
  return 'Other';
}

function normalizeScanPayload(parsed) {
  return {
    fullName: String(parsed?.fullName ?? '').trim(),
    email: String(parsed?.email ?? '').trim(),
    phone: String(parsed?.phone ?? '').trim(),
    nationality: normalizeNationality(parsed?.nationality),
    birthDate: mmddyyyyToIso(parsed?.birthDate),
    idType: normalizeIdType(parsed?.idType),
    idNumber: String(parsed?.idNumber ?? '').trim(),
    idExpiry: mmddyyyyToIso(parsed?.idExpiry),
  };
}

function toFormFields(normalized) {
  return {
    name: normalized.fullName,
    email: normalized.email,
    phone: normalized.phone,
    nationality: normalized.nationality,
    birthDate: normalized.birthDate,
    idType: normalized.idType,
    idNumber: normalized.idNumber,
    idExpiry: normalized.idExpiry,
  };
}

/**
 * Resolve API key/model from `kyc_scanner_api` (active row).
 */
async function resolveScannerConfig() {
  const fromDb = await getActiveKycScannerApi();
  if (fromDb?.apiKey) {
    return { apiKey: fromDb.apiKey, model: fromDb.model };
  }
  return null;
}

/**
 * Extract tenant ID fields from an uploaded image using Gemini structured output.
 * @param {{ buffer: Buffer, mimetype: string }} file
 */
export async function scanTenantIdImage(file) {
  const config = await resolveScannerConfig();
  if (!config?.apiKey) {
    const err = new Error(
      'ID auto-fill is not available. Please set up the scanner API key, or enter the details manually.',
    );
    err.statusCode = 503;
    err.code = 'SCANNER_NOT_CONFIGURED';
    throw err;
  }

  const mimeType = String(file.mimetype ?? '').toLowerCase();
  if (!mimeType.startsWith('image/')) {
    const err = new Error('Only image files can be scanned for ID details.');
    err.statusCode = 400;
    throw err;
  }

  const buffer = file.buffer;
  if (!buffer?.length) {
    const err = new Error('Uploaded image is empty.');
    err.statusCode = 400;
    throw err;
  }

  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  const base64 = buffer.toString('base64');

  let response;
  try {
    response = await ai.models.generateContent({
      model: config.model,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                'You are an OCR assistant for tenant registration. Read the government ID image and extract the requested fields accurately. ' +
                'Use empty strings when a value is not visible. Dates must use MM/DD/YYYY. ' +
                'For idType: use Driver\'s License when the card is an LTO or driving license (including professional/non-professional). ' +
                'Use UMID for Philsys, UMID, or Philippine national ID cards. Use Passport for passports. Otherwise use Other.',
            },
            {
              inlineData: {
                mimeType,
                data: base64,
              },
            },
          ],
        },
      ],
      config: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseJsonSchema: ID_SCAN_RESPONSE_JSON_SCHEMA,
      },
    });
  } catch (e) {
    const err = new Error(e instanceof Error ? e.message : 'Gemini ID scan failed.');
    err.statusCode = 502;
    throw err;
  }

  const text = String(response?.text ?? '').trim();
  if (!text) {
    const err = new Error('Gemini returned an empty ID scan result.');
    err.statusCode = 502;
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const err = new Error('Gemini returned invalid JSON for ID scan.');
    err.statusCode = 502;
    throw err;
  }

  const normalized = normalizeScanPayload(parsed);
  if (!normalized.fullName && !normalized.idNumber) {
    const err = new Error('Could not read name or ID number from the uploaded image.');
    err.statusCode = 422;
    throw err;
  }

  return {
    raw: normalized,
    data: toFormFields(normalized),
  };
}
