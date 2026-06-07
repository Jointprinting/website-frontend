// Built-in sample content so the site looks complete before Sanity is connected.
// Once the CMS is wired up (env vars set), real content replaces all of this.

const img = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1400&q=70`;

// Build a date N days from now at a given hour, returned as ISO.
const soon = (days, hour = 18, mins = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, mins, 0, 0);
  return d.toISOString();
};

export const sampleSettings = {
  name: "Lantern Barn",
  tagline: "Coffee, community & good company on the river.",
  description:
    "A restored barn and gathering place on the Ottauquechee in Bridgewater, Vermont — pour-over coffee, riverside seating, local makers, and a calendar full of reasons to come hang out.",
  heroHeadline: "A gathering place on the river.",
  heroSubhead:
    "Good coffee, open doors, and a porch over the water in Bridgewater, Vermont.",
  heroImage: { url: img("photo-1500382017468-9049fed747ef"), alt: "Sun over a Vermont river valley" },
  address: "1234 US-4, Bridgewater, VT 05034",
  hours: [
    { day: "Mon", open: "Closed" },
    { day: "Tue – Thu", open: "8am – 4pm" },
    { day: "Fri", open: "8am – 8pm" },
    { day: "Sat", open: "9am – 8pm" },
    { day: "Sun", open: "9am – 3pm" },
  ],
  phone: "(802) 555-0142",
  email: "hello@lanternbarn.com",
  instagram: "https://instagram.com/",
  facebook: "https://facebook.com/",
  mapUrl: "https://maps.google.com/?q=Bridgewater,+VT",
  gallery: [
    { url: img("photo-1442975631115-c4f7b05b8a2c"), alt: "Pour-over coffee" },
    { url: img("photo-1501785888041-af3ef285b470"), alt: "River and mountains" },
    { url: img("photo-1525610553991-2bede1a236e2"), alt: "Cozy interior" },
    { url: img("photo-1470770841072-f978cf4d019e"), alt: "Lake and woods" },
    { url: img("photo-1498804103079-a6351b050096"), alt: "Latte art" },
    { url: img("photo-1504387828636-abeb50778c0c"), alt: "Outdoor seating" },
  ],
};

export const sampleEvents = [
  {
    _id: "e1",
    title: "Sunday Coffee & Vinyl",
    slug: "sunday-coffee-and-vinyl",
    startsAt: soon(3, 9),
    endsAt: soon(3, 12),
    location: "The Barn",
    recurring: "Every Sunday",
    summary: "Bring a record, we'll bring the coffee. Slow mornings by the river.",
    image: { url: img("photo-1459749411175-04bf5292ceea"), alt: "Vinyl records" },
  },
  {
    _id: "e2",
    title: "Open Mic Night",
    slug: "open-mic-night",
    startsAt: soon(5, 19),
    endsAt: soon(5, 22),
    location: "The Barn",
    recurring: "First Friday monthly",
    summary: "Songwriters, poets, and storytellers welcome. Sign-ups at the door.",
    image: { url: img("photo-1514525253161-7a46d19cd819"), alt: "Live music" },
  },
  {
    _id: "e3",
    title: "Riverside Morning Yoga",
    slug: "riverside-morning-yoga",
    startsAt: soon(8, 8),
    endsAt: soon(8, 9, 15),
    location: "River Deck",
    recurring: "Saturdays in summer",
    summary: "All-levels flow on the deck over the Ottauquechee. Coffee after.",
    image: { url: img("photo-1506126613408-eca07ce68773"), alt: "Yoga at sunrise" },
  },
  {
    _id: "e4",
    title: "Board Game & Puzzle Night",
    slug: "board-game-and-puzzle-night",
    startsAt: soon(11, 18),
    endsAt: soon(11, 21),
    location: "The Loft",
    recurring: "Every other Thursday",
    summary: "Big table, full shelf of games, bottomless decaf. Bring a friend.",
    image: { url: img("photo-1606092195730-5d7b9af1efc5"), alt: "Board games" },
  },
];

export const sampleProducts = [
  {
    _id: "p1",
    title: "Lantern Barn Mug",
    slug: "lantern-barn-mug",
    price: 22,
    featured: true,
    summary: "Heavy stoneware mug, glazed in river-stone gray. Holds 12oz of good morning.",
    image: { url: img("photo-1514228742587-6b1558fcca3d"), alt: "Ceramic mug" },
  },
  {
    _id: "p2",
    title: "Beeswax Candle",
    slug: "beeswax-candle",
    price: 18,
    featured: true,
    summary: "Hand-poured by a neighbor down the road. Smells like a Vermont evening.",
    image: { url: img("photo-1602874801006-e26d4c92f5a9"), alt: "Candle" },
  },
  {
    _id: "p3",
    title: "Canvas Tote",
    slug: "canvas-tote",
    price: 24,
    featured: false,
    summary: "Sturdy natural canvas with the barn mark. Farmers-market approved.",
    image: { url: img("photo-1597484661643-2f5fef640dd1"), alt: "Canvas tote bag" },
  },
  {
    _id: "p4",
    title: "Wildflower Honey",
    slug: "wildflower-honey",
    price: 14,
    featured: false,
    summary: "Raw honey from hives just up the valley. Limited each season.",
    image: { url: img("photo-1587049352846-4a222e784d38"), alt: "Jar of honey" },
  },
  {
    _id: "p5",
    title: "Whole Bean Coffee",
    slug: "whole-bean-coffee",
    price: 19,
    featured: true,
    summary: "Our house roast, 12oz. Bright, balanced, made for a slow pour.",
    image: { url: img("photo-1559056199-641a0ac8b55e"), alt: "Coffee beans" },
  },
  {
    _id: "p6",
    title: "Barn Sticker Pack",
    slug: "barn-sticker-pack",
    price: 8,
    featured: false,
    summary: "Three weatherproof stickers. For your water bottle, laptop, or canoe.",
    image: { url: img("photo-1626785774573-4b799315345d"), alt: "Stickers" },
  },
];
