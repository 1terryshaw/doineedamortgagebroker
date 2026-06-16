export interface Region {
  id: string;
  name: string;
  slug: string;
  province: string;
  latitude: number | null;
  longitude: number | null;
  population: number | null;
  created_at: string;
  updated_at: string;
}

export interface Specialization {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  created_at: string;
}

export interface Listing {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  province: string;
  state_province: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  google_place_id: string | null;
  google_rating: number | null;
  google_review_count: number;
  google_photos: string[];
  logo_url: string | null;
  cover_image_url: string | null;
  years_in_business: number | null;
  license_number: string | null;
  languages: string[];
  enrichment_status: string;
  enrichment_data: Record<string, unknown> | null;
  claimed: boolean;
  claimed_by: string | null;
  claimed_at: string | null;
  is_premium: boolean;
  premium_tier: string | null;
  premium_expires_at: string | null;
  status: string;
  region_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  region?: Region;
  specializations?: Specialization[];
  mortgage_listing_specializations?: { specialization_id: string; mortgage_specializations: Specialization }[];
}

export interface Inquiry {
  id: string;
  listing_id: string;
  sender_name: string;
  sender_email: string;
  sender_phone: string | null;
  message: string | null;
  loan_type: string | null;
  property_value: number | null;
  down_payment: number | null;
  employment_type: string | null;
  first_time_buyer: boolean;
  status: string;
  notification_sent: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  variables: string[];
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SearchParams {
  city?: string;
  specialization?: string;
  rating?: string;
  sort?: string;
  page?: string;
  q?: string;
}
