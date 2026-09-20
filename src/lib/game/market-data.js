/**
 * market-data.js — real market calibration for ReFiAI Tycoon.
 * Spanish cities: LIVE data — Source: Fragua by Atlas Real Estate Analytics (pulled 2026-09-20).
 * miami/nyc/london/paris: instructor benchmark ESTIMATES (estimate:true) — refine before launch.
 * Embedded as a module so players need no API subscription.
 */
export const MARKET_DATA = {
 "meta": {
  "spanishCities": {
   "source": "Fragua by Atlas Real Estate Analytics",
   "pulledAt": "2026-09-20",
   "note": "Live API pull: residential market KPIs per postal code. grossYield = rentM2*12/priceM2."
  },
  "otherCities": {
   "source": "Instructor benchmark estimates — NOT Fragua; refine before launch",
   "estimate": true
  }
 },
 "cities": {
  "madrid": {
   "estimate": false,
   "districts": [
    {
     "postalCode": "28012",
     "district": "Centro — Lavapiés",
     "priceM2": 6903.65,
     "rentM2Month": 30.46,
     "grossYield": 0.0529,
     "avgPrice": 610992.53,
     "supply": 754.0,
     "negotiationMargin": 0.057,
     "daysToSell": 35.93,
     "absorption3m": 0.1365
    },
    {
     "postalCode": "28015",
     "district": "Chamberí",
     "priceM2": 8365.77,
     "rentM2Month": 29.36,
     "grossYield": 0.0421,
     "avgPrice": 919678.59,
     "supply": 613.0,
     "negotiationMargin": 0.0,
     "daysToSell": 31.96,
     "absorption3m": 0.1663
    },
    {
     "postalCode": "28045",
     "district": "Arganzuela — Delicias",
     "priceM2": 6424.04,
     "rentM2Month": 27.48,
     "grossYield": 0.0513,
     "avgPrice": 509249.85,
     "supply": 483.0,
     "negotiationMargin": 0.0,
     "daysToSell": 25.41,
     "absorption3m": 0.1804
    }
   ]
  },
  "barcelona": {
   "estimate": false,
   "districts": [
    {
     "postalCode": "08003",
     "district": "Ciutat Vella — El Born",
     "priceM2": 5757.68,
     "rentM2Month": 29.36,
     "grossYield": 0.0612,
     "avgPrice": 461992.8,
     "supply": 996.0,
     "negotiationMargin": 0.1581,
     "daysToSell": 40.92,
     "absorption3m": 0.0806
    },
    {
     "postalCode": "08013",
     "district": "Eixample — Fort Pienc",
     "priceM2": 6346.83,
     "rentM2Month": 31.68,
     "grossYield": 0.0599,
     "avgPrice": 603275.74,
     "supply": 540.0,
     "negotiationMargin": 0.0892,
     "daysToSell": 35.36,
     "absorption3m": 0.1484
    },
    {
     "postalCode": "08025",
     "district": "Gràcia — Camp d'en Grassot",
     "priceM2": 5735.94,
     "rentM2Month": 28.36,
     "grossYield": 0.0593,
     "avgPrice": 504192.87,
     "supply": 617.0,
     "negotiationMargin": 0.0854,
     "daysToSell": 33.84,
     "absorption3m": 0.1408
    }
   ]
  },
  "valencia": {
   "estimate": false,
   "districts": [
    {
     "postalCode": "46004",
     "district": "Eixample — Gran Vía",
     "priceM2": 5914.55,
     "rentM2Month": 20.79,
     "grossYield": 0.0422,
     "avgPrice": 1122950.85,
     "supply": 114.0,
     "negotiationMargin": 0.1546,
     "daysToSell": 114.23,
     "absorption3m": 0.0936
    },
    {
     "postalCode": "46011",
     "district": "Poblats Marítims — Cabanyal",
     "priceM2": 4024.16,
     "rentM2Month": 20.42,
     "grossYield": 0.0609,
     "avgPrice": 395532.45,
     "supply": 513.0,
     "negotiationMargin": 0.1875,
     "daysToSell": 49.38,
     "absorption3m": 0.138
    },
    {
     "postalCode": "46023",
     "district": "Camins al Grau",
     "priceM2": 4310.21,
     "rentM2Month": 18.64,
     "grossYield": 0.0519,
     "avgPrice": 511486.81,
     "supply": 286.0,
     "negotiationMargin": 0.3,
     "daysToSell": 47.08,
     "absorption3m": 0.181
    }
   ]
  },
  "miami": {
   "estimate": true,
   "districts": [
    {
     "postalCode": "33131",
     "district": "Brickell",
     "priceM2": 6000,
     "rentM2Month": 35,
     "grossYield": 0.07,
     "avgPrice": 570000,
     "supply": 300,
     "negotiationMargin": 0.06,
     "daysToSell": 45,
     "absorption3m": 0.12
    },
    {
     "postalCode": "33127",
     "district": "Wynwood — Edgewater",
     "priceM2": 5200,
     "rentM2Month": 32,
     "grossYield": 0.0738,
     "avgPrice": 494000,
     "supply": 300,
     "negotiationMargin": 0.08,
     "daysToSell": 55,
     "absorption3m": 0.12
    },
    {
     "postalCode": "33134",
     "district": "Coral Gables",
     "priceM2": 5600,
     "rentM2Month": 30,
     "grossYield": 0.0643,
     "avgPrice": 532000,
     "supply": 300,
     "negotiationMargin": 0.05,
     "daysToSell": 50,
     "absorption3m": 0.12
    }
   ]
  },
  "nyc": {
   "estimate": true,
   "districts": [
    {
     "postalCode": "10017",
     "district": "Midtown East",
     "priceM2": 9000,
     "rentM2Month": 45,
     "grossYield": 0.06,
     "avgPrice": 855000,
     "supply": 300,
     "negotiationMargin": 0.07,
     "daysToSell": 70,
     "absorption3m": 0.12
    },
    {
     "postalCode": "10005",
     "district": "Financial District",
     "priceM2": 8000,
     "rentM2Month": 42,
     "grossYield": 0.063,
     "avgPrice": 760000,
     "supply": 300,
     "negotiationMargin": 0.09,
     "daysToSell": 80,
     "absorption3m": 0.12
    },
    {
     "postalCode": "11201",
     "district": "Downtown Brooklyn",
     "priceM2": 7000,
     "rentM2Month": 38,
     "grossYield": 0.0651,
     "avgPrice": 665000,
     "supply": 300,
     "negotiationMargin": 0.06,
     "daysToSell": 60,
     "absorption3m": 0.12
    }
   ]
  },
  "london": {
   "estimate": true,
   "districts": [
    {
     "postalCode": "E14",
     "district": "Canary Wharf",
     "priceM2": 9500,
     "rentM2Month": 42,
     "grossYield": 0.0531,
     "avgPrice": 902500,
     "supply": 300,
     "negotiationMargin": 0.06,
     "daysToSell": 75,
     "absorption3m": 0.12
    },
    {
     "postalCode": "EC2A",
     "district": "Shoreditch",
     "priceM2": 10500,
     "rentM2Month": 46,
     "grossYield": 0.0526,
     "avgPrice": 997500,
     "supply": 300,
     "negotiationMargin": 0.05,
     "daysToSell": 65,
     "absorption3m": 0.12
    },
    {
     "postalCode": "CR0",
     "district": "Croydon",
     "priceM2": 6500,
     "rentM2Month": 32,
     "grossYield": 0.0591,
     "avgPrice": 617500,
     "supply": 300,
     "negotiationMargin": 0.08,
     "daysToSell": 55,
     "absorption3m": 0.12
    }
   ]
  },
  "paris": {
   "estimate": true,
   "season2": true,
   "districts": [
    {
     "postalCode": "75004",
     "district": "Le Marais",
     "priceM2": 13500,
     "rentM2Month": 42,
     "grossYield": 0.0373,
     "avgPrice": 1282500,
     "supply": 300,
     "negotiationMargin": 0.04,
     "daysToSell": 80,
     "absorption3m": 0.12
    },
    {
     "postalCode": "92800",
     "district": "La Défense (Puteaux)",
     "priceM2": 8500,
     "rentM2Month": 38,
     "grossYield": 0.0536,
     "avgPrice": 807500,
     "supply": 300,
     "negotiationMargin": 0.07,
     "daysToSell": 85,
     "absorption3m": 0.12
    },
    {
     "postalCode": "93200",
     "district": "Saint-Denis",
     "priceM2": 5500,
     "rentM2Month": 28,
     "grossYield": 0.0611,
     "avgPrice": 522500,
     "supply": 300,
     "negotiationMargin": 0.09,
     "daysToSell": 70,
     "absorption3m": 0.12
    }
   ]
  }
 }
};
