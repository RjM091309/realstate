import { listPublicUnitListings } from '../models/unitsModel.js';
import { resolveUnitPhotos, parseStringArrayJson } from './unitsController.js';

/** Admin `unit_type` values → public website `PropertyType`. */
const UNIT_TYPE_TO_PROPERTY_TYPE = {
  'House and Lot': 'House & Lot',
  Condominium: 'Condominium',
  Apartment: 'Condominium',
  'Commercial Building': 'Commercial',
  Warehouse: 'Commercial',
  Hotel: 'Commercial',
  'Office Space': 'Commercial',
  // Legacy size-only types (kept for existing saved units)
  Studio: 'Condominium',
  '1BR': 'Condominium',
  '2BR': 'Condominium',
  '3BR': 'Condominium',
  Loft: 'Condominium',
  Penthouse: 'Condominium',
};

/** Admin `listing_type` → public website `PropertyStatus`. */
const LISTING_TYPE_TO_STATUS = {
  monthly_rental: 'For Rent',
  short_term_rental: 'For Rent',
  selling: 'For Sale',
  pre_selling: 'Pre-Selling',
};

const FALLBACK_IMAGE =
  'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1400&h=900&fit=crop&auto=format';

/** Some seeded area names carry an ordering prefix like "1. Clark" — strip it for public display. */
function cleanAreaName(raw) {
  return String(raw ?? '').trim().replace(/^\d+\.\s*/, '');
}

function mapUnitRowToListing(row) {
  const images = resolveUnitPhotos(row);
  const listingType = String(row.listing_type ?? 'monthly_rental');
  const isForRent = listingType === 'monthly_rental' || listingType === 'short_term_rental';
  const marketValue = row.market_value == null ? null : Number(row.market_value);
  const monthlyRate = row.monthly_rate == null ? null : Number(row.monthly_rate);
  const price = isForRent ? monthlyRate ?? 0 : marketValue ?? monthlyRate ?? 0;
  // Public description comes ONLY from listing_description (dedicated marketing copy).
  // more_details/special_remarks are internal admin notes — never show those publicly.
  const description =
    String(row.listing_description ?? '').trim() ||
    'Contact us for more details about this property.';

  return {
    id: String(row.id),
    title: `${String(row.building_name ?? '').trim()} — Unit ${String(row.unit_number ?? '').trim()}`,
    location: String(row.common_address || row.legal_address || row.building_name || '').trim(),
    city: cleanAreaName(row.area),
    type: UNIT_TYPE_TO_PROPERTY_TYPE[row.unit_type] ?? 'Condominium',
    status: LISTING_TYPE_TO_STATUS[listingType] ?? 'For Rent',
    price,
    bedrooms: row.bedrooms == null ? undefined : Number(row.bedrooms),
    bathrooms: row.bathrooms == null ? undefined : Number(row.bathrooms),
    area: row.area_sqm == null ? 0 : Number(row.area_sqm),
    lotArea: row.lot_area_sqm == null ? undefined : Number(row.lot_area_sqm),
    parking: row.parking_slot ? 1 : undefined,
    floors: row.floors_label ? String(row.floors_label) : undefined,
    image: images[0] ?? FALLBACK_IMAGE,
    images: images.length > 0 ? images : [FALLBACK_IMAGE],
    featured: Boolean(Number(row.featured ?? 0)),
    isNew: Boolean(Number(row.is_new_listing ?? 0)),
    developer: row.developer ? String(row.developer) : undefined,
    description,
    amenities: parseStringArrayJson(row.amenities_json),
    features: parseStringArrayJson(row.features_json),
  };
}

/**
 * Public, unauthenticated feed for the marketing website — Available/Reserved
 * units only, mapped into the website's `Property` shape. Never expose
 * tenant/contract/financial data through this endpoint.
 */
export async function listPublicListings(_req, res) {
  try {
    const rows = await listPublicUnitListings();
    res.json({ listings: rows.map(mapUnitRowToListing) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to load listings' });
  }
}
