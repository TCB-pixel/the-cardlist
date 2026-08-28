export type Product = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  category: "sealed" | "single" | "preorder" | "accessory";
  tcg: "onepiece" | "pokemon" | "mtg" | "dragonball";
  rarity: string | null;
  badge: string | null;
  image_url: string | null;
  created_at: string;
};

export type Event = {
  id: string;
  title: string;
  description: string | null;
  location: string;
  date: string;
  time: string;
  max_slots: number;
  booked_slots: number;
  tcg: string;
  format: string | null;
  image_url: string | null;
  created_at: string;
};

export type Booking = {
  id: string;
  user_id: string;
  event_id: string;
  status: "confirmed" | "cancelled";
  qr_code: string;
  created_at: string;
};

export type NewsPost = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  tag: string;
  image_url: string | null;
  published_at: string;
};

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  tier: "bronze" | "silver" | "gold" | "platinum";
  points: number;
  created_at: string;
};

export type CartItem = {
  product: Product;
  quantity: number;
};

// ── Artist Cards ──
export type ArtistCategory = {
  id: string;
  name: string;
  slug: string;
  order: number;
  active: boolean;
  created_at: string;
};

export type Artist = {
  id: string;
  name: string;
  slug: string;
  bio: string | null;
  avatar_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  x_url: string | null;
  order: number;
  active: boolean;
  created_at: string;
};

export type ArtistCard = {
  id: string;
  artist_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  rarity: string | null;
  limited_count: number | null;
  collection: string | null;
  release_year: number | null;
  order: number;
  active: boolean;
  created_at: string;
};
