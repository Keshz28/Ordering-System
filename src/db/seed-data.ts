/**
 * Static content for the demo restaurant. Kept separate from seed.ts so the
 * insert logic stays readable and the menu can be edited without touching code.
 */

const U = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=70`;

export const CATEGORIES = [
  {
    name: "Starters",
    description: "Small plates to open the table",
    image: U("photo-1572695157366-5e585ab2b69f"),
  },
  {
    name: "Pizza",
    description: "72-hour cold-fermented dough, wood-fired",
    image: U("photo-1513104890138-7c749659a591"),
  },
  {
    name: "Pasta",
    description: "Rolled and cut fresh every morning",
    image: U("photo-1621996346565-e3dbc646d9a9"),
  },
  {
    name: "Mains",
    description: "From the grill and the pass",
    image: U("photo-1546964124-0cce460f38ef"),
  },
  {
    name: "Desserts",
    description: "Dolci, the way nonna intended",
    image: U("photo-1571877227200-a0d98ea607e9"),
  },
  {
    name: "Drinks",
    description: "Espresso, spritz and cellar picks",
    image: U("photo-1560512823-829485b8bf24"),
  },
];

export type SeedItem = {
  category: string;
  name: string;
  description: string;
  price: number;
  image: string;
  allergens: string[];
  prepMinutes: number;
  featured?: boolean;
  stock?: number | null;
  availableFrom?: string;
  availableTo?: string;
  /** Which modifier templates attach to this item. */
  modifiers?: ("pizzaSize" | "pizzaToppings" | "pastaAddon" | "doneness" | "drinkSize")[];
  /** Rough popularity weight used when generating historical orders. */
  weight?: number;
};

export const ITEMS: SeedItem[] = [
  // ---------------------------------------------------------------- Starters
  {
    category: "Starters",
    name: "Bruschetta Classica",
    description:
      "Grilled sourdough, San Marzano tomato, torn basil, Sicilian olive oil.",
    price: 8.5,
    image: U("photo-1572695157366-5e585ab2b69f"),
    allergens: ["gluten"],
    prepMinutes: 7,
    featured: true,
    weight: 9,
  },
  {
    category: "Starters",
    name: "Garlic Bread al Forno",
    description:
      "Wood-fired flatbread, roasted garlic butter, fior di latte, parsley.",
    price: 4.0,
    image: U("photo-1573140247632-f8fd74997d5c"),
    allergens: ["gluten", "dairy"],
    prepMinutes: 6,
    weight: 12,
  },
  {
    category: "Starters",
    name: "Arancini di Riso",
    description:
      "Saffron risotto spheres, smoked scamorza centre, spicy arrabbiata.",
    price: 9.5,
    image: U("photo-1633504581786-316c8002b1b9"),
    allergens: ["gluten", "dairy", "egg"],
    prepMinutes: 10,
    stock: 18,
    weight: 6,
  },
  {
    category: "Starters",
    name: "Burrata & Heirloom Tomato",
    description:
      "Whole Puglian burrata, heirloom tomatoes, aged balsamic, basil oil.",
    price: 13.0,
    image: U("photo-1505253716362-afaea1d3d1af"),
    allergens: ["dairy"],
    prepMinutes: 6,
    featured: true,
    stock: 9,
    weight: 7,
  },
  {
    category: "Starters",
    name: "Calamari Fritti",
    description: "Lightly floured squid, lemon aioli, charred lemon cheek.",
    price: 12.0,
    image: U("photo-1599487488170-d11ec9c172f0"),
    allergens: ["gluten", "shellfish", "egg"],
    prepMinutes: 11,
    weight: 6,
  },

  // ------------------------------------------------------------------- Pizza
  {
    category: "Pizza",
    name: "Margherita D.O.P.",
    description:
      "San Marzano, fior di latte, basil, extra virgin olive oil. The benchmark.",
    price: 14.5,
    image: U("photo-1574071318508-1cdbab80d002"),
    allergens: ["gluten", "dairy"],
    prepMinutes: 14,
    featured: true,
    modifiers: ["pizzaSize", "pizzaToppings"],
    weight: 16,
  },
  {
    category: "Pizza",
    name: "Diavola Piccante",
    description: "Spicy nduja, soppressata, chilli honey, smoked mozzarella.",
    price: 17.5,
    image: U("photo-1513104890138-7c749659a591"),
    allergens: ["gluten", "dairy"],
    prepMinutes: 15,
    featured: true,
    modifiers: ["pizzaSize", "pizzaToppings"],
    weight: 13,
  },
  {
    category: "Pizza",
    name: "Quattro Formaggi",
    description:
      "Gorgonzola dolce, taleggio, parmigiano, fior di latte, walnut crumb.",
    price: 18.0,
    image: U("photo-1548369937-47519962c11a"),
    allergens: ["gluten", "dairy", "nuts"],
    prepMinutes: 15,
    modifiers: ["pizzaSize", "pizzaToppings"],
    weight: 8,
  },
  {
    category: "Pizza",
    name: "Tartufo Nero",
    description:
      "Black truffle cream, wild mushroom, taleggio, thyme, truffle oil finish.",
    price: 21.0,
    image: U("photo-1595854341625-f33ee10dbf94"),
    allergens: ["gluten", "dairy"],
    prepMinutes: 16,
    stock: 6,
    modifiers: ["pizzaSize", "pizzaToppings"],
    weight: 6,
  },
  {
    category: "Pizza",
    name: "Ortolana Verde",
    description:
      "Grilled courgette, aubergine, peppers, vegan mozzarella, salsa verde.",
    price: 16.0,
    image: U("photo-1565299624946-b28f40a0ae38"),
    allergens: ["gluten"],
    prepMinutes: 14,
    modifiers: ["pizzaSize", "pizzaToppings"],
    weight: 7,
  },

  // ------------------------------------------------------------------- Pasta
  {
    category: "Pasta",
    name: "Spaghetti Carbonara",
    description:
      "Guanciale, Pecorino Romano, black pepper, egg yolk. No cream, ever.",
    price: 16.5,
    image: U("photo-1612874742237-6526221588e3"),
    allergens: ["gluten", "dairy", "egg"],
    prepMinutes: 13,
    featured: true,
    modifiers: ["pastaAddon"],
    weight: 15,
  },
  {
    category: "Pasta",
    name: "Tagliatelle al Ragù",
    description: "Eight-hour beef and pork ragù, ribbons of egg tagliatelle.",
    price: 18.0,
    image: U("photo-1621996346565-e3dbc646d9a9"),
    allergens: ["gluten", "dairy", "egg"],
    prepMinutes: 14,
    modifiers: ["pastaAddon"],
    weight: 12,
  },
  {
    category: "Pasta",
    name: "Ravioli di Zucca",
    description:
      "Roast pumpkin and amaretti ravioli, brown butter, crisp sage, hazelnut.",
    price: 17.0,
    image: U("photo-1587740908075-9e245070dfaa"),
    allergens: ["gluten", "dairy", "egg", "nuts"],
    prepMinutes: 13,
    modifiers: ["pastaAddon"],
    weight: 8,
  },
  {
    category: "Pasta",
    name: "Gnocchi Sorrentina",
    description:
      "Potato gnocchi baked in tomato and basil under a bubbling mozzarella lid.",
    price: 15.5,
    image: U("photo-1595295333158-4742f28fbd85"),
    allergens: ["gluten", "dairy"],
    prepMinutes: 15,
    modifiers: ["pastaAddon"],
    weight: 9,
  },
  {
    category: "Pasta",
    name: "Linguine alle Vongole",
    description: "Clams, white wine, garlic, chilli, parsley, bottarga dust.",
    price: 21.0,
    image: U("photo-1473093295043-cdd812d0e601"),
    allergens: ["gluten", "shellfish"],
    prepMinutes: 15,
    stock: 12,
    modifiers: ["pastaAddon"],
    weight: 7,
  },

  // ------------------------------------------------------------------- Mains
  {
    category: "Mains",
    name: "Bistecca alla Fiorentina",
    description:
      "500g dry-aged T-bone, rosemary salt, charred lemon, rocket and parmesan.",
    price: 42.0,
    image: U("photo-1546964124-0cce460f38ef"),
    allergens: ["dairy"],
    prepMinutes: 24,
    featured: true,
    stock: 8,
    modifiers: ["doneness"],
    weight: 5,
  },
  {
    category: "Mains",
    name: "Salmone al Cartoccio",
    description:
      "Scottish salmon baked in paper with fennel, olives and Amalfi lemon.",
    price: 26.0,
    image: U("photo-1467003909585-2f8a72700288"),
    allergens: ["fish"],
    prepMinutes: 20,
    weight: 6,
  },
  {
    category: "Mains",
    name: "Pollo alla Parmigiana",
    description:
      "Free-range chicken, San Marzano, basil, mozzarella, herbed crumb.",
    price: 23.0,
    image: U("photo-1632778149955-e80f8ceca2e8"),
    allergens: ["gluten", "dairy", "egg"],
    prepMinutes: 21,
    modifiers: ["doneness"],
    weight: 8,
  },
  {
    category: "Mains",
    name: "Risotto ai Funghi",
    description:
      "Carnaroli rice, porcini and chestnut mushrooms, aged parmigiano.",
    price: 19.5,
    image: U("photo-1476124369491-e7addf5db371"),
    allergens: ["dairy"],
    prepMinutes: 22,
    weight: 6,
  },

  // ---------------------------------------------------------------- Desserts
  {
    category: "Desserts",
    name: "Tiramisù della Casa",
    description:
      "Savoiardi soaked in single-origin espresso, mascarpone cream, cocoa.",
    price: 9.0,
    image: U("photo-1571877227200-a0d98ea607e9"),
    allergens: ["gluten", "dairy", "egg"],
    prepMinutes: 4,
    featured: true,
    weight: 11,
  },
  {
    category: "Desserts",
    name: "Panna Cotta ai Frutti",
    description: "Vanilla bean panna cotta, macerated berries, pistachio brittle.",
    price: 8.5,
    image: U("photo-1488477181946-6428a0291777"),
    allergens: ["dairy", "nuts"],
    prepMinutes: 4,
    weight: 7,
  },
  {
    category: "Desserts",
    name: "Cannoli Siciliani",
    description: "Crisp shells piped to order, ricotta, candied orange, pistachio.",
    price: 8.0,
    image: U("photo-1607478900766-efe13248b125"),
    allergens: ["gluten", "dairy", "nuts"],
    prepMinutes: 5,
    weight: 6,
  },
  {
    category: "Desserts",
    name: "Gelato Trio",
    description:
      "Three scoops from the daily churn — ask your server what's spinning.",
    price: 7.5,
    image: U("photo-1567206563064-6f60f40a2b57"),
    allergens: ["dairy"],
    prepMinutes: 3,
    weight: 6,
  },

  // ------------------------------------------------------------------ Drinks
  {
    category: "Drinks",
    name: "Aperol Spritz",
    description: "Aperol, prosecco, soda, blood orange. The 5pm ritual.",
    price: 11.0,
    image: U("photo-1560512823-829485b8bf24"),
    allergens: [],
    prepMinutes: 4,
    availableFrom: "16:00",
    availableTo: "23:00",
    modifiers: ["drinkSize"],
    weight: 8,
  },
  {
    category: "Drinks",
    name: "Espresso Doppio",
    description: "Double shot, Neapolitan roast, served with a lemon twist.",
    price: 3.5,
    image: U("photo-1509042239860-f550ce710b93"),
    allergens: [],
    prepMinutes: 3,
    modifiers: ["drinkSize"],
    weight: 10,
  },
  {
    category: "Drinks",
    name: "Limonata Siciliana",
    description: "Hand-pressed Amalfi lemons, cane sugar, mint, sparkling water.",
    price: 5.5,
    image: U("photo-1621263764928-df1444c5e859"),
    allergens: [],
    prepMinutes: 3,
    modifiers: ["drinkSize"],
    weight: 9,
  },
  {
    category: "Drinks",
    name: "Chianti Classico (glass)",
    description: "Sangiovese, Tuscany. Cherry, leather, a long dry finish.",
    price: 12.0,
    image: U("photo-1510812431401-41d2bd2722f3"),
    allergens: ["sulphites"],
    prepMinutes: 2,
    availableFrom: "12:00",
    availableTo: "23:30",
    weight: 7,
  },
];

export const MODIFIER_TEMPLATES = {
  pizzaSize: {
    name: "Choose your size",
    selectionType: "single" as const,
    required: true,
    minSelection: 1,
    maxSelection: 1,
    options: [
      { name: 'Small — 9"', priceDelta: -2.5 },
      { name: 'Regular — 12"', priceDelta: 0, isDefault: true },
      { name: 'Large — 16"', priceDelta: 4.5 },
    ],
  },
  pizzaToppings: {
    name: "Extra toppings",
    selectionType: "multi" as const,
    required: false,
    minSelection: 0,
    maxSelection: 5,
    options: [
      { name: "Extra fior di latte", priceDelta: 2.0 },
      { name: "Spicy nduja", priceDelta: 3.0 },
      { name: "Prosciutto di Parma", priceDelta: 3.5 },
      { name: "Taggiasca olives", priceDelta: 1.5 },
      { name: "Truffle oil drizzle", priceDelta: 3.0 },
      { name: "Fresh basil", priceDelta: 0.5 },
    ],
  },
  pastaAddon: {
    name: "Make it yours",
    selectionType: "multi" as const,
    required: false,
    minSelection: 0,
    maxSelection: 3,
    options: [
      { name: "Grilled chicken", priceDelta: 5.0 },
      { name: "Tiger prawns", priceDelta: 6.5 },
      { name: "Extra parmigiano", priceDelta: 1.5 },
      { name: "Gluten-free pasta", priceDelta: 2.0 },
    ],
  },
  doneness: {
    name: "How would you like it cooked?",
    selectionType: "single" as const,
    required: true,
    minSelection: 1,
    maxSelection: 1,
    options: [
      { name: "Rare", priceDelta: 0 },
      { name: "Medium rare", priceDelta: 0, isDefault: true },
      { name: "Medium", priceDelta: 0 },
      { name: "Well done", priceDelta: 0 },
    ],
  },
  drinkSize: {
    name: "Size",
    selectionType: "single" as const,
    required: true,
    minSelection: 1,
    maxSelection: 1,
    options: [
      { name: "Regular", priceDelta: 0, isDefault: true },
      { name: "Large", priceDelta: 1.75 },
    ],
  },
};

export const ZONES = [
  {
    name: "Downtown",
    radiusKm: 2,
    fee: 0,
    minOrder: 15,
    etaMinutes: 25,
  },
  {
    name: "Midtown",
    radiusKm: 5,
    fee: 3,
    minOrder: 20,
    etaMinutes: 35,
  },
  {
    name: "Suburbs",
    radiusKm: 10,
    fee: 6,
    minOrder: 35,
    etaMinutes: 50,
  },
];

export const TIERS = [
  {
    name: "Bronze",
    minPoints: 0,
    earnRate: 10,
    discountRate: 0,
    freeDelivery: false,
    color: "#A97142",
    benefits: [
      "10 points per $1 spent",
      "Birthday reward",
      "Members-only offers",
    ],
  },
  {
    name: "Silver",
    minPoints: 500,
    earnRate: 15,
    discountRate: 0.05,
    freeDelivery: false,
    color: "#8E9AA6",
    benefits: [
      "15 points per $1 spent",
      "5% off every order, automatically",
      "Priority pickup window",
    ],
  },
  {
    name: "Gold",
    minPoints: 1500,
    earnRate: 25,
    discountRate: 0.1,
    freeDelivery: true,
    color: "#C9A227",
    benefits: [
      "25 points per $1 spent",
      "10% off every order, automatically",
      "Free delivery on every order",
      "First access to new menu drops",
    ],
  },
];

export const REDEMPTIONS = [
  {
    name: "$5 off your order",
    description: "A straight $5 off, no minimum fuss.",
    pointsCost: 200,
    rewardType: "fixed_off" as const,
    rewardValue: 5,
    minSpend: 15,
    validDays: 60,
  },
  {
    name: "Free dessert",
    description: "Any dolce from the pastry section, on us.",
    pointsCost: 300,
    rewardType: "free_item" as const,
    rewardValue: 0,
    freeItemName: "Tiramisù della Casa",
    minSpend: 20,
    validDays: 60,
  },
  {
    name: "Free starter",
    description: "Open the table with something from the antipasti.",
    pointsCost: 500,
    rewardType: "free_item" as const,
    rewardValue: 0,
    freeItemName: "Bruschetta Classica",
    minSpend: 25,
    validDays: 60,
  },
  {
    name: "15% off the whole order",
    description: "Best value on a big table.",
    pointsCost: 750,
    rewardType: "percent_off" as const,
    rewardValue: 15,
    minSpend: 40,
    validDays: 45,
  },
  {
    name: "$25 off a feast",
    description: "For the celebration bookings.",
    pointsCost: 1200,
    rewardType: "fixed_off" as const,
    rewardValue: 25,
    minSpend: 80,
    validDays: 45,
  },
];

export const STAFF = [
  {
    name: "Marco Rinaldi",
    email: "owner@bellacucina.demo",
    role: "owner" as const,
  },
  {
    name: "Elena Bianchi",
    email: "manager@bellacucina.demo",
    role: "manager" as const,
  },
  {
    name: "Tom Whitfield",
    email: "cashier@bellacucina.demo",
    role: "cashier" as const,
  },
  {
    name: "Priya Raman",
    email: "kitchen@bellacucina.demo",
    role: "kitchen" as const,
  },
  {
    name: "Sofia Greco",
    email: "cashier2@bellacucina.demo",
    role: "cashier" as const,
  },
  {
    name: "Luca Moretti",
    email: "kitchen2@bellacucina.demo",
    role: "kitchen" as const,
  },
];

export type SeedCustomer = {
  name: string;
  email: string;
  phone: string;
  birthday: string;
  allergies: string[];
  preferences?: string;
  /** Drives how many historical orders this person gets. */
  frequency: "heavy" | "regular" | "occasional" | "once" | "lapsed";
};

export const CUSTOMERS: SeedCustomer[] = [
  { name: "Amelia Hart", email: "amelia.hart@example.com", phone: "(555) 201-8834", birthday: "1991-08-19", allergies: ["nuts"], preferences: "Window table, still water", frequency: "heavy" },
  { name: "Daniel Okafor", email: "daniel.okafor@example.com", phone: "(555) 244-1190", birthday: "1986-02-04", allergies: [], preferences: "Always orders the Diavola", frequency: "heavy" },
  { name: "Priyanka Shah", email: "priyanka.shah@example.com", phone: "(555) 277-4521", birthday: "1994-11-27", allergies: ["shellfish"], preferences: "Vegetarian most visits", frequency: "heavy" },
  { name: "Marcus Lindberg", email: "marcus.lindberg@example.com", phone: "(555) 290-7712", birthday: "1979-05-12", allergies: [], preferences: "Wine pairing, no rush", frequency: "regular" },
  { name: "Chloé Dubois", email: "chloe.dubois@example.com", phone: "(555) 311-2098", birthday: "1997-08-16", allergies: ["dairy"], preferences: "Asks for dairy-free swaps", frequency: "regular" },
  { name: "Ben Castellano", email: "ben.castellano@example.com", phone: "(555) 336-6641", birthday: "1988-09-30", allergies: [], frequency: "regular" },
  { name: "Nadia Haddad", email: "nadia.haddad@example.com", phone: "(555) 350-8123", birthday: "1992-01-08", allergies: ["gluten"], preferences: "Gluten-free pasta every time", frequency: "regular" },
  { name: "Oliver Grant", email: "oliver.grant@example.com", phone: "(555) 374-9910", birthday: "1983-06-21", allergies: [], preferences: "Big group bookings", frequency: "regular" },
  { name: "Sara Mendes", email: "sara.mendes@example.com", phone: "(555) 388-2277", birthday: "1996-03-14", allergies: [], frequency: "occasional" },
  { name: "Jonas Weber", email: "jonas.weber@example.com", phone: "(555) 402-5566", birthday: "1990-12-02", allergies: ["egg"], frequency: "occasional" },
  { name: "Aisha Bello", email: "aisha.bello@example.com", phone: "(555) 419-3348", birthday: "1993-08-25", allergies: [], preferences: "Delivery only, leave at door", frequency: "occasional" },
  { name: "Tomás Rivera", email: "tomas.rivera@example.com", phone: "(555) 433-7712", birthday: "1985-10-09", allergies: [], frequency: "occasional" },
  { name: "Grace Whitmore", email: "grace.whitmore@example.com", phone: "(555) 447-1129", birthday: "1999-04-18", allergies: ["nuts", "dairy"], frequency: "occasional" },
  { name: "Hiroshi Tanaka", email: "hiroshi.tanaka@example.com", phone: "(555) 458-9902", birthday: "1981-07-07", allergies: [], preferences: "Counter seat, espresso to finish", frequency: "occasional" },
  { name: "Lena Kowalski", email: "lena.kowalski@example.com", phone: "(555) 466-4471", birthday: "1995-08-13", allergies: [], frequency: "once" },
  { name: "Ethan Brooks", email: "ethan.brooks@example.com", phone: "(555) 472-8890", birthday: "1998-02-26", allergies: [], frequency: "once" },
  { name: "Farida Nasser", email: "farida.nasser@example.com", phone: "(555) 488-3312", birthday: "1987-11-05", allergies: ["fish"], frequency: "once" },
  { name: "Callum Reid", email: "callum.reid@example.com", phone: "(555) 495-6620", birthday: "1984-09-16", allergies: [], preferences: "Used to come weekly", frequency: "lapsed" },
  { name: "Isabella Ferrari", email: "isabella.ferrari@example.com", phone: "(555) 502-7734", birthday: "1989-05-29", allergies: [], preferences: "Regular before she moved districts", frequency: "lapsed" },
  { name: "Yusuf Demir", email: "yusuf.demir@example.com", phone: "(555) 517-2245", birthday: "1992-08-11", allergies: ["sulphites"], frequency: "lapsed" },
];

export const REVIEW_COMMENTS = [
  { rating: 5, comment: "Best carbonara outside Rome. The guanciale is the real thing." },
  { rating: 5, comment: "Delivery arrived hot and 8 minutes early. Genuinely impressed." },
  { rating: 4, comment: "Lovely pizza, though the base was a touch pale for my taste." },
  { rating: 5, comment: "The burrata is worth the trip on its own. Staff remembered my allergy." },
  { rating: 3, comment: "Food was great but we waited 20 minutes past our booking time." },
  { rating: 5, comment: "Took the whole team here. Split the bill on the app in seconds." },
  { rating: 4, comment: "Tiramisù is dangerously good. Slightly pricey for the portion." },
  { rating: 5, comment: "Ordered on my phone at the table, food came out in 12 minutes." },
  { rating: 2, comment: "My gnocchi arrived lukewarm. The manager sorted it out quickly though." },
  { rating: 5, comment: "The Gold tier free delivery has basically paid for my habit." },
  { rating: 4, comment: "Loved the truffle pizza. Wish it was on the menu permanently." },
  { rating: 5, comment: "Booked for my birthday and they applied the $10 reward automatically." },
  { rating: 4, comment: "Solid every single time. That's the hardest thing to do." },
  { rating: 5, comment: "The spritz at happy hour is the best value in the district." },
  { rating: 3, comment: "Good food, but the delivery driver couldn't find the entrance." },
];

export const TABLES = [
  { number: 1, seats: 2, zone: "Main Floor" },
  { number: 2, seats: 2, zone: "Main Floor" },
  { number: 3, seats: 4, zone: "Main Floor" },
  { number: 4, seats: 4, zone: "Main Floor" },
  { number: 5, seats: 4, zone: "Main Floor" },
  { number: 6, seats: 6, zone: "Main Floor" },
  { number: 7, seats: 2, zone: "Main Floor" },
  { number: 8, seats: 8, zone: "Main Floor" },
  { number: 9, seats: 2, zone: "Terrace" },
  { number: 10, seats: 2, zone: "Terrace" },
  { number: 11, seats: 4, zone: "Terrace" },
  { number: 12, seats: 4, zone: "Terrace" },
  { number: 13, seats: 6, zone: "Terrace" },
  { number: 14, seats: 6, zone: "Terrace" },
];

export const OPENING_HOURS = {
  monday: { open: "12:00", close: "22:00" },
  tuesday: { open: "12:00", close: "22:00" },
  wednesday: { open: "12:00", close: "22:00" },
  thursday: { open: "12:00", close: "23:00" },
  friday: { open: "12:00", close: "23:30" },
  saturday: { open: "11:00", close: "23:30" },
  sunday: { open: "11:00", close: "21:00" },
};
