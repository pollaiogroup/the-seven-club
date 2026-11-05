export type Role = 'member' | 'moderator' | 'admin' | 'super_admin';

export type Me = {
  id: string;
  role: Role;
  status: 'active' | 'suspended';
  handle: string;
  full_name: string;
  avatar_path: string | null;
  unread: number;
  email?: string;
};

export type MemberCard = {
  id: string;
  handle: string;
  full_name: string;
  avatar_path: string | null;
  headline: string | null;
};

export type Media = { path: string; width: number | null; height: number | null };

export type Post = {
  id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  context: 'member' | 'business' | 'project';
  source: 'manual' | 'seven' | 'affirmation';
  hidden: boolean;
  author: MemberCard | null;
  business: { id: string; slug: string; name: string; logo_path: string | null } | null;
  project: { id: string; slug: string; name: string; visibility: 'club' | 'private' } | null;
  pillar: { slug: string; name: string } | null;
  affirmation: { text: string; theme: string } | null;
  media: Media[];
  like_count: number;
  comment_count: number;
  liked: boolean;
  saved: boolean;
  mine: boolean;
  can_moderate: boolean;
};

export type Comment = {
  id: string;
  body: string;
  created_at: string;
  hidden: boolean;
  author: MemberCard | null;
  mine: boolean;
  can_moderate: boolean;
};

export type BusinessCard = {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logo_path: string | null;
  cover_path: string | null;
  city: string | null;
  featured: boolean;
  category: { slug: string; name: string } | null;
  owner: MemberCard | null;
};

export type Offering = { id: string; kind: 'product' | 'service'; name: string; description: string | null; price_text: string | null };

export type BusinessPage = BusinessCard & {
  description: string | null;
  instagram: string | null;
  website: string | null;
  whatsapp: string | null;
  address: string | null;
  service_area: string | null;
  category_id: number;
  hidden: boolean;
  can_edit: boolean;
  is_owner: boolean;
  admins: (MemberCard & { role: 'owner' | 'admin' })[];
  offerings: Offering[];
  media: (Media & { id: string })[];
};

export type ProjectCard = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  visibility: 'club' | 'private';
  cover_path: string | null;
  owner: MemberCard | null;
  member_count: number;
};

export type ProjectPage = Omit<ProjectCard, 'member_count'> & {
  created_at: string;
  hidden: boolean;
  is_owner: boolean;
  is_member: boolean;
  can_edit: boolean;
  members: (MemberCard & { role: 'owner' | 'collaborator' })[];
};

export type ProfilePage = {
  id: string;
  handle: string;
  full_name: string;
  headline: string | null;
  bio: string | null;
  city: string | null;
  interests: string[];
  avatar_path: string | null;
  instagram: string | null;
  website: string | null;
  member_since: string;
  role: Role;
  is_me: boolean;
  blocked_by_me: boolean;
  post_count: number;
  businesses: { id: string; slug: string; name: string; tagline: string | null; logo_path: string | null; role: string }[];
  projects: { id: string; slug: string; name: string; category: string; cover_path: string | null; visibility: string; role: string }[];
};

export type Pillar = {
  id: number;
  slug: string;
  name: string;
  description: string;
  prompt: string;
  check_in: {
    id: string;
    completed_at: string | null;
    note: string | null;
    photo_path: string | null;
    activity_id: string | null;
    shared: boolean;
  } | null;
  activities: { id: string; title: string; mine: boolean }[];
};

export type SevenOverview = {
  today: string;
  month: string;
  streak: number;
  best_streak: number;
  calendar: { day: string; done: number }[];
  pillars: { slug: string; name: string; week: number; month: number; total: number }[];
  weeks: { week_start: string; done: number }[];
};

export type Affirmation = {
  id: string;
  text: string;
  theme: string;
  day: string | null;
  favorited: boolean;
  shared?: boolean;
};

export type EventItem = {
  id: string;
  title: string;
  description: string | null;
  kind: string;
  starts_at: string;
  ends_at: string | null;
  location: string | null;
  cover_path: string | null;
  capacity: number | null;
  published: boolean;
  show_attendees: boolean;
  online_url: string | null;
  has_online_url: boolean;
  taken: number;
  my_status: 'registered' | 'confirmed' | 'cancelled' | null;
  attendees?: (MemberCard & { status: string })[] | null;
};

export type Notification = {
  id: string;
  kind: string;
  title: string | null;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
  actor: MemberCard | null;
};

export type ActionResult = { ok?: boolean; error?: string; message?: string; redirect?: string } | null;

// ---------------------------------------------------------------- clube do livro
export type Book = { id: string; title: string; author: string | null; cover_path: string | null };

export type BookClubHome = {
  today: string;
  current: {
    id: string; month: string; note: string | null; book: Book; readers: number; joined: boolean;
    meeting: { id: string; title: string; starts_at: string; kind: string; location: string | null } | null;
  } | null;
  poll: {
    id: string; target_month: string; opens_on: string; closes_on: string; status: 'open' | 'closed';
    my_vote: string | null; winner_book_id: string | null; options: Book[];
    results: { book_id: string; votes: number }[] | null;
  } | null;
  coupons: { id: string; store: string; code: string; url: string | null; details: string | null; valid_until: string | null; book: Book; business: { slug: string; name: string } | null }[];
  past: { month: string; book: Book }[];
};

export type LibraryEntry = { id: string; rating: number; review: string | null; finished_on: string | null; created_at: string; book: Book };
