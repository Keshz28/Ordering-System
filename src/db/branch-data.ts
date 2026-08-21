import type { OpeningHours, TableShape } from "./schema";

/**
 * The four outlets and their dining rooms.
 *
 * Table coordinates are percentages of the floor-plan box (x/y = centre,
 * w/h = size), so one set of numbers renders correctly on a phone and on a
 * desktop without a second mobile layout. Each branch has a deliberately
 * different arrangement — a narrow shophouse, a wide family hall, a garden
 * deck and a corporate lakeside room — so the picker doesn't feel like the
 * same grid four times.
 */

export type SeedTable = {
  number: number;
  label?: string;
  seats: number;
  zone: string;
  shape: TableShape;
  x: number;
  y: number;
  w: number;
  h: number;
  bookable?: boolean;
};

export type SeedBranch = {
  slug: string;
  name: string;
  shortName: string;
  address: string;
  city: string;
  state: string;
  postcode: string;
  phone: string;
  lat: number;
  lng: number;
  image: string;
  blurb: string;
  floorPlanNote: string;
  deliveryRadiusKm: number;
  openingHours: OpeningHours;
  tables: SeedTable[];
};

const LATE = { open: "11:00", close: "23:30" };
const NORMAL = { open: "11:00", close: "22:30" };

const hours = (weekend = LATE, weekday = NORMAL): OpeningHours => ({
  monday: weekday,
  tuesday: weekday,
  wednesday: weekday,
  thursday: weekday,
  friday: weekend,
  saturday: weekend,
  sunday: weekday,
});

/* -------------------------------------------------------------------------- */
/*  1. Bangsar — the flagship shophouse: narrow, buzzy, chef's counter         */
/* -------------------------------------------------------------------------- */

const bangsarTables: SeedTable[] = [
  // Stools at the pass, facing the wood-fired oven
  { number: 1, label: "C1", seats: 2, zone: "Chef's Counter", shape: "counter", x: 32, y: 18, w: 11, h: 8 },
  { number: 2, label: "C2", seats: 2, zone: "Chef's Counter", shape: "counter", x: 50, y: 18, w: 11, h: 8 },
  { number: 3, label: "C3", seats: 2, zone: "Chef's Counter", shape: "counter", x: 68, y: 18, w: 11, h: 8 },
  // Two-tops along the street windows
  { number: 4, seats: 2, zone: "Window Row", shape: "round", x: 14, y: 34, w: 13, h: 10 },
  { number: 5, seats: 2, zone: "Window Row", shape: "round", x: 14, y: 48, w: 13, h: 10 },
  { number: 6, seats: 2, zone: "Window Row", shape: "round", x: 14, y: 62, w: 13, h: 10 },
  { number: 7, seats: 2, zone: "Window Row", shape: "round", x: 14, y: 76, w: 13, h: 10 },
  // Banquette down the brick wall
  { number: 8, seats: 4, zone: "Banquette", shape: "booth", x: 85, y: 36, w: 15, h: 11 },
  { number: 9, seats: 4, zone: "Banquette", shape: "booth", x: 85, y: 51, w: 15, h: 11 },
  { number: 10, seats: 4, zone: "Banquette", shape: "booth", x: 85, y: 66, w: 15, h: 11 },
  { number: 11, seats: 6, zone: "Banquette", shape: "booth", x: 85, y: 82, w: 15, h: 13 },
  // Centre of the room
  { number: 12, seats: 4, zone: "Main Floor", shape: "square", x: 48, y: 32, w: 15, h: 12 },
  { number: 13, label: "Communal", seats: 10, zone: "Main Floor", shape: "rect", x: 48, y: 53, w: 34, h: 12 },
  { number: 14, seats: 4, zone: "Main Floor", shape: "round", x: 48, y: 75, w: 15, h: 12 },
];

/* -------------------------------------------------------------------------- */
/*  2. Setapak — wide neighbourhood hall built for families                    */
/* -------------------------------------------------------------------------- */

const setapakTables: SeedTable[] = [
  // Two-tops just inside the door
  { number: 1, seats: 2, zone: "Entrance", shape: "round", x: 13, y: 26, w: 11, h: 15 },
  { number: 2, seats: 2, zone: "Entrance", shape: "round", x: 13, y: 52, w: 11, h: 15 },
  // Six-seat rounds through the middle — the family default
  { number: 3, seats: 6, zone: "Main Hall", shape: "round", x: 30, y: 28, w: 15, h: 21 },
  { number: 4, seats: 6, zone: "Main Hall", shape: "round", x: 50, y: 28, w: 15, h: 21 },
  { number: 5, seats: 6, zone: "Main Hall", shape: "round", x: 70, y: 28, w: 15, h: 21 },
  { number: 6, seats: 6, zone: "Main Hall", shape: "round", x: 30, y: 54, w: 15, h: 21 },
  { number: 7, seats: 4, zone: "Main Hall", shape: "square", x: 50, y: 54, w: 13, h: 18 },
  { number: 8, seats: 6, zone: "Main Hall", shape: "round", x: 70, y: 54, w: 15, h: 21 },
  // The long family tables
  { number: 9, label: "Family A", seats: 8, zone: "Family Corner", shape: "rect", x: 90, y: 28, w: 13, h: 26 },
  { number: 10, label: "Family B", seats: 8, zone: "Family Corner", shape: "rect", x: 90, y: 56, w: 13, h: 26 },
  // Covered garden terrace across the back
  { number: 11, seats: 4, zone: "Garden Terrace", shape: "square", x: 20, y: 80, w: 12, h: 16 },
  { number: 12, seats: 4, zone: "Garden Terrace", shape: "square", x: 40, y: 80, w: 12, h: 16 },
  { number: 13, seats: 4, zone: "Garden Terrace", shape: "square", x: 60, y: 80, w: 12, h: 16 },
  { number: 14, seats: 4, zone: "Garden Terrace", shape: "square", x: 80, y: 80, w: 12, h: 16 },
];

/* -------------------------------------------------------------------------- */
/*  3. Bukit Jelutong — garden suburb, alfresco deck under the rain trees      */
/* -------------------------------------------------------------------------- */

const bukitJelutongTables: SeedTable[] = [
  // Deck tables, scattered under the trees rather than gridded
  { number: 1, seats: 4, zone: "Alfresco Deck", shape: "round", x: 20, y: 20, w: 14, h: 20 },
  { number: 2, seats: 4, zone: "Alfresco Deck", shape: "round", x: 39, y: 18, w: 14, h: 20 },
  { number: 3, seats: 2, zone: "Alfresco Deck", shape: "round", x: 18, y: 44, w: 11, h: 15 },
  { number: 4, seats: 4, zone: "Alfresco Deck", shape: "round", x: 38, y: 44, w: 14, h: 20 },
  { number: 5, seats: 6, zone: "Alfresco Deck", shape: "round", x: 27, y: 68, w: 16, h: 23 },
  { number: 6, seats: 2, zone: "Alfresco Deck", shape: "round", x: 18, y: 88, w: 11, h: 15 },
  { number: 7, seats: 2, zone: "Alfresco Deck", shape: "round", x: 38, y: 88, w: 11, h: 15 },
  // Indoor, air-conditioned
  { number: 8, seats: 4, zone: "Indoor Dining", shape: "square", x: 68, y: 32, w: 13, h: 18 },
  { number: 9, seats: 4, zone: "Indoor Dining", shape: "square", x: 88, y: 32, w: 13, h: 18 },
  { number: 10, seats: 4, zone: "Indoor Dining", shape: "square", x: 68, y: 54, w: 13, h: 18 },
  { number: 11, seats: 4, zone: "Indoor Dining", shape: "square", x: 85, y: 54, w: 13, h: 18 },
  // Curtains off for a private eight
  { number: 12, label: "The Nook", seats: 8, zone: "Private Nook", shape: "booth", x: 78, y: 15, w: 26, h: 12 },
  // Under the pergola
  { number: 13, label: "Pergola", seats: 12, zone: "Alfresco Deck", shape: "rect", x: 72, y: 82, w: 34, h: 12 },
  { number: 14, seats: 2, zone: "Indoor Dining", shape: "counter", x: 60, y: 70, w: 9, h: 12 },
];

/* -------------------------------------------------------------------------- */
/*  4. Putrajaya — lakeside, business lunches and long boardroom tables        */
/* -------------------------------------------------------------------------- */

const putrajayaTables: SeedTable[] = [
  // The lake-view row everyone asks for
  { number: 1, label: "Lake 1", seats: 4, zone: "Lake View", shape: "square", x: 14, y: 22, w: 13, h: 19 },
  { number: 2, label: "Lake 2", seats: 4, zone: "Lake View", shape: "square", x: 32, y: 22, w: 13, h: 19 },
  { number: 3, label: "Lake 3", seats: 2, zone: "Lake View", shape: "round", x: 50, y: 22, w: 10, h: 15 },
  { number: 4, label: "Lake 4", seats: 4, zone: "Lake View", shape: "square", x: 68, y: 22, w: 13, h: 19 },
  { number: 5, label: "Lake 5", seats: 4, zone: "Lake View", shape: "square", x: 86, y: 22, w: 13, h: 19 },
  // Working lunches
  { number: 6, label: "Boardroom A", seats: 10, zone: "Boardroom", shape: "rect", x: 29, y: 44, w: 32, h: 13 },
  { number: 7, label: "Boardroom B", seats: 10, zone: "Boardroom", shape: "rect", x: 72, y: 44, w: 32, h: 13 },
  // Main floor
  { number: 8, seats: 4, zone: "Main Floor", shape: "square", x: 16, y: 70, w: 13, h: 19 },
  { number: 9, seats: 4, zone: "Main Floor", shape: "square", x: 36, y: 70, w: 13, h: 19 },
  { number: 10, seats: 4, zone: "Main Floor", shape: "square", x: 56, y: 70, w: 13, h: 19 },
  { number: 11, seats: 6, zone: "Main Floor", shape: "round", x: 78, y: 70, w: 15, h: 22 },
  // Quiet two-tops at the back
  { number: 12, seats: 2, zone: "Main Floor", shape: "round", x: 26, y: 90, w: 11, h: 15 },
  { number: 13, seats: 2, zone: "Main Floor", shape: "round", x: 50, y: 90, w: 11, h: 15 },
  { number: 14, seats: 2, zone: "Main Floor", shape: "round", x: 74, y: 90, w: 11, h: 15 },
];

/* -------------------------------------------------------------------------- */

export const BRANCHES: SeedBranch[] = [
  {
    slug: "bangsar",
    name: "Bella Cucina Bangsar",
    shortName: "Bangsar",
    address: "12 Jalan Telawi 3, Bangsar Baru",
    city: "Kuala Lumpur",
    state: "Kuala Lumpur",
    postcode: "59100",
    phone: "+60 3-2201 8845",
    lat: 3.1319,
    lng: 101.6708,
    image:
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=70",
    blurb: "The original. Wood-fired oven in full view, always full by eight.",
    floorPlanNote:
      "A narrow shophouse room — counter seats face the pass, booths line the brick wall, and the communal table seats ten.",
    deliveryRadiusKm: 7,
    openingHours: hours(),
    tables: bangsarTables,
  },
  {
    slug: "setapak",
    name: "Bella Cucina Setapak",
    shortName: "Setapak",
    address: "88 Jalan Genting Klang, Setapak",
    city: "Kuala Lumpur",
    state: "Kuala Lumpur",
    postcode: "53300",
    phone: "+60 3-4023 7712",
    lat: 3.1958,
    lng: 101.7255,
    image:
      "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1200&q=70",
    blurb: "Our family room — big round tables, high chairs, and a garden out back.",
    floorPlanNote:
      "A wide hall built for groups: six-seat rounds through the middle, two eight-seat family tables, and a covered garden terrace.",
    deliveryRadiusKm: 9,
    openingHours: hours(NORMAL, NORMAL),
    tables: setapakTables,
  },
  {
    slug: "bukit-jelutong",
    name: "Bella Cucina Bukit Jelutong",
    shortName: "Bukit Jelutong",
    address: "5 Jalan Bazar U8/U8, Bukit Jelutong",
    city: "Shah Alam",
    state: "Selangor",
    postcode: "40150",
    phone: "+60 3-7845 2290",
    lat: 3.0855,
    lng: 101.5432,
    image:
      "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?auto=format&fit=crop&w=1200&q=70",
    blurb: "Alfresco under the rain trees, and the quietest private nook we own.",
    floorPlanNote:
      "Half the room is outdoors. Tables on the deck sit under the trees, the pergola table seats twelve, and the Nook curtains off for eight.",
    deliveryRadiusKm: 10,
    openingHours: hours(),
    tables: bukitJelutongTables,
  },
  {
    slug: "putrajaya",
    name: "Bella Cucina Putrajaya",
    shortName: "Putrajaya",
    address: "Lot G-14 Jalan Alamanda, Presint 1",
    city: "Putrajaya",
    state: "Putrajaya",
    postcode: "62000",
    phone: "+60 3-8890 4417",
    lat: 2.9264,
    lng: 101.6964,
    image:
      "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=70",
    blurb: "Lake views and two boardroom tables — the business lunch outlet.",
    floorPlanNote:
      "Windows run the length of the lake. Two ten-seat boardroom tables take the middle for working lunches.",
    deliveryRadiusKm: 12,
    openingHours: hours(NORMAL, NORMAL),
    tables: putrajayaTables,
  },
];

export const BRANCH_SLUGS = BRANCHES.map((b) => b.slug);
