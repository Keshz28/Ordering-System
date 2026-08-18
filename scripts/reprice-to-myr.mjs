/**
 * One-shot repricing of the seed catalogue from USD to MYR.
 *
 * Prices are not converted at an FX rate — they are set to what a modern-casual
 * Italian restaurant in the Klang Valley actually charges, which is what a
 * Malaysian restaurateur will sanity-check during a demo.
 *
 * Rewrites the `price:` line that follows each `name:` line, so duplicate
 * prices across different dishes can never be confused with one another.
 *
 *   node scripts/reprice-to-myr.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const FILE = "src/db/seed-data.ts";

/** Dish name -> new ringgit price. */
const DISH_PRICES = {
  // Starters
  "Bruschetta Classica": 22,
  "Garlic Bread al Forno": 12,
  "Arancini di Riso": 24,
  "Burrata & Heirloom Tomato": 38,
  "Calamari Fritti": 32,
  // Pizza
  "Margherita D.O.P.": 32,
  "Diavola Piccante": 42,
  "Quattro Formaggi": 45,
  "Tartufo Nero": 58,
  "Ortolana Verde": 38,
  // Pasta
  "Spaghetti Carbonara": 38,
  "Tagliatelle al Ragù": 42,
  "Ravioli di Zucca": 40,
  "Gnocchi Sorrentina": 36,
  "Linguine alle Vongole": 52,
  // Mains
  "Bistecca alla Fiorentina": 168,
  "Salmone al Cartoccio": 62,
  "Pollo alla Parmigiana": 52,
  "Risotto ai Funghi": 46,
  // Desserts
  "Tiramisù della Casa": 24,
  "Panna Cotta ai Frutti": 22,
  "Cannoli Siciliani": 20,
  "Gelato Trio": 18,
  // Drinks
  "Aperol Spritz": 32,
  "Espresso Doppio": 12,
  "Limonata Siciliana": 14,
  "Chianti Classico (glass)": 38,
};

/** Modifier option name -> new ringgit delta. */
const MODIFIER_DELTAS = {
  'Small — 9"': -6,
  'Large — 16"': 12,
  "Extra fior di latte": 6,
  "Spicy nduja": 9,
  "Prosciutto di Parma": 10,
  "Taggiasca olives": 5,
  "Truffle oil drizzle": 9,
  "Fresh basil": 2,
  "Grilled chicken": 14,
  "Tiger prawns": 18,
  "Extra parmigiano": 5,
  "Gluten-free pasta": 6,
  Large: 5,
};

let text = readFileSync(FILE, "utf8");
const lines = text.split(/\r?\n/);

let pendingDish = null;
let dishHits = 0;
let modifierHits = 0;
const missed = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  // Inline modifier options: { name: "X", priceDelta: N }
  const inline = line.match(/\{\s*name:\s*(['"])(.+?)\1,\s*priceDelta:\s*(-?[\d.]+)/);
  if (inline) {
    const optionName = inline[2];
    if (Object.hasOwn(MODIFIER_DELTAS, optionName)) {
      const next = MODIFIER_DELTAS[optionName];
      lines[i] = line.replace(
        /priceDelta:\s*-?[\d.]+/,
        `priceDelta: ${next}`,
      );
      modifierHits++;
    }
    continue;
  }

  // Dish: remember the name, rewrite the price line that follows.
  const nameMatch = line.match(/^\s*name:\s*(['"])(.+?)\1,\s*$/);
  if (nameMatch) {
    pendingDish = nameMatch[2];
    continue;
  }

  const priceMatch = line.match(/^(\s*)price:\s*[\d.]+,\s*$/);
  if (priceMatch && pendingDish) {
    if (Object.hasOwn(DISH_PRICES, pendingDish)) {
      lines[i] = `${priceMatch[1]}price: ${DISH_PRICES[pendingDish]},`;
      dishHits++;
    } else {
      missed.push(pendingDish);
    }
    pendingDish = null;
  }
}

writeFileSync(FILE, lines.join("\n"));

console.log(`dishes repriced   : ${dishHits}/${Object.keys(DISH_PRICES).length}`);
console.log(`modifiers repriced: ${modifierHits}`);
if (missed.length) console.log("NO PRICE MAPPED  :", missed.join(", "));
