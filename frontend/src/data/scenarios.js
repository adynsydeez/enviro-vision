import daguilar from '../assets/D-Aguilar.jpg';
import lamington from '../assets/Lamington.jpg';
import glassHouseMountains from '../assets/Glass-House-Mountains.jpg';
import bunyaMountains from '../assets/Bunya-Mountains.jpg';
import girraween from '../assets/Girraween.jpg';
import eungella from '../assets/Eungella.jpg';

export const RISK_LEVELS = {
  Catastrophic: { label: 'Catastrophic', color: 'text-red-400', bg: 'bg-red-950 border-red-800' },
  Extreme:      { label: 'Extreme',      color: 'text-orange-400', bg: 'bg-orange-950 border-orange-800' },
  High:         { label: 'High',         color: 'text-amber-400', bg: 'bg-amber-950 border-amber-800' },
};

const scenarios = [
  {
    id: 'daguilar',
    name: "D'Aguilar National Park",
    state: 'QLD',
    year: 2023,
    center: [-27.291, 152.8196],
    zoom: 14,
    description: 'Subtropical dry sclerophyll forest north-west of Brisbane. Dry lightning ignition with complex terrain channelling wind through ridge lines.',
    areaHa: '22,000',
    risk: 'High',
    image: daguilar,
    introMessages: [
      "Whoa! Look at those flames in D'Aguilar!",
      "I'm your Project Pyro assistant. Let's save some trees!",
      "I may be just a mascot, but I've got some serious firefighting skills!",
      "Click anywhere to see the mission details..."
    ],
    mascotDialogue: {
      water: ["Splash! That'll cool 'em down!", "Found some water, finally!", "Time to rain on their parade!"],
      wind: ["Whoa, hold on to your hats!", "The wind is shifting... not good!", "Is it getting drafty in here?"],
      idle: ["Is it getting hot in here?", "I think I smell smoke... oh wait.", "I hope we have enough snacks for this mission.", "Did I leave the oven on?"],
      victory: ["We did it! D'Aguilar is safe!", "You're a natural, Commander!"],
      defeat: ["Well, that didn't go as planned...", "Time to start looking for a new forest."]
    }
  },
  {
    id: 'lamington',
    name: 'Lamington National Park',
    state: 'QLD',
    year: 2019,
    center: [-28.139, 153.109],
    zoom: 14,
    description: 'Subtropical rainforest–eucalypt interface in the McPherson Range. Rapid boundary flare-ups and spotting across deep valleys from ember cast.',
    areaHa: '6,000',
    risk: 'High',
    image: lamington,
    introMessages: [
      "Lamington is looking a bit crispy today!",
      "Wait, is that the McPherson Range or a barbecue range?",
      "Watch out for the ember cast, it's a real party pooper!",
      "Let's keep the rainforest wet and the fire dry... wait, that doesn't make sense."
    ],
    mascotDialogue: {
      water: ["That's some high-quality H2O!", "Extinguishing with style!", "Take that, fire!"],
      wind: ["Hold on to your socks, it's getting windy!", "McPherson Range wind is no joke!", "The wind is making the fire dance!"],
      idle: ["I wonder if there are any wallabies around.", "Lamington... now I'm hungry for cake.", "Should I have brought a raincoat?", "Anyone want to play I-Spy? I see... smoke."],
      victory: ["Lamington is saved! Let's celebrate with... Lamingtons!", "Great job, Commander! You really McPherson'd it!"],
      defeat: ["Well, at least we tried. Anyone for a smoky bushwalk?", "Lamington is feeling the heat... and so am I."]
    }
  },
  {
    id: 'glass-house-mountains',
    name: 'Glass House Mountains',
    state: 'QLD',
    year: 2019,
    center: [-26.883, 152.957],
    zoom: 14,
    description: 'Open eucalypt forest and heath across the Sunshine Coast hinterland. Fast-moving grassfire flanks driven by strong north-westerlies threatened townships and wildlife corridors.',
    areaHa: '28,000',
    risk: 'Extreme',
    image: glassHouseMountains,
    introMessages: [
      "The Glass House Mountains are getting a bit too much heat!",
      "Sunshine Coast? More like Smoke Coast right now!",
      "Watch out for those north-westerlies, they're faster than my lunch break!",
      "Time to save the hinterland!"
    ],
    mascotDialogue: {
      water: ["Splish splash, I was takin' a fire out!", "Liquid courage for the forest!", "Keep it coming!"],
      wind: ["The wind is pushing the fire towards the town!", "Whoa, that's a strong breeze!", "North-westerlies are being a real pain!"],
      idle: ["I hope the wildlife found a safe spot.", "These mountains look like houses, but they're made of glass? Wait, no.", "Is it lunchtime yet?", "I should've worn more sunscreen."],
      victory: ["The hinterland is safe! Sunshine Coast is back in business!", "You're the MVP, Commander!"],
      defeat: ["That fire moved too fast. We'll get 'em next time.", "The Glass House is looking a bit... shattered."]
    }
  },
  {
    id: 'bunya-mountains',
    name: 'Bunya Mountains',
    state: 'QLD',
    year: 2019,
    center: [-26.885, 151.597],
    zoom: 14,
    description: 'Ancient bunya pine and hoop pine rainforest on the Darling Downs escarpment. Drought-stressed understorey carried fire into stands not burned in living memory.',
    areaHa: '12,000',
    risk: 'High',
    image: bunyaMountains,
    introMessages: [
      "Ancient pines in Bunya are in trouble!",
      "Don't let the Bunya nuts roast too early!",
      "Drought-stressed understorey? That's not a good sign.",
      "Time to protect the Darling Downs escarpment!"
    ],
    mascotDialogue: {
      water: ["Watering the ancient pines!", "Hydration for the escarpment!", "Take a cold shower, fire!"],
      wind: ["Wind is picking up on the escarpment!", "The pines are swaying, and not in a good way!", "Is that a draft or just the fire breathing?"],
      idle: ["I wonder how old these Bunya pines really are.", "I'm craving some roasted Bunya nuts now.", "Did I mention I'm afraid of heights?", "This escarpment is steep!"],
      victory: ["The Bunya Mountains are safe! The nuts are secure!", "You're a legend, Commander!"],
      defeat: ["The ancient forest took a hit. This is a sad day for Bunya.", "We couldn't save the escarpment..."]
    }
  },
  {
    id: 'girraween',
    name: 'Girraween National Park',
    state: 'QLD',
    year: 2019,
    center: [-28.837, 151.938],
    zoom: 14,
    description: 'Granite-belt dry sclerophyll on the Queensland–NSW border. Record heat and zero humidity produced extreme fire behaviour across exposed rock slopes and stringybark forest.',
    areaHa: '36,000',
    risk: 'Catastrophic',
    image: girraween,
    introMessages: [
      "Girraween is feeling the 'Record Heat'!",
      "Granite-belt? More like Fire-belt today!",
      "Zero humidity? My skin is already feeling dry!",
      "Let's keep the exposed rock slopes from becoming hot plates!"
    ],
    mascotDialogue: {
      water: ["Cooling down the granite!", "Making it rain in the dry sclerophyll!", "Wet rock is better than hot rock!"],
      wind: ["The wind is whipping around the granite boulders!", "Hold your ground, it's getting gusty!", "That wind is record-breaking!"],
      idle: ["I wish I was a rock, they don't seem to care about the heat.", "Is it just me or is the zero humidity making my hair look weird?", "I hope I don't slip on these granite slopes.", "This is 'Catastrophic' fun, isn't it?"],
      victory: ["Girraween is safe! The granite belt survives!", "You're fireproof, Commander!"],
      defeat: ["Catastrophic indeed. Girraween will need time to recover.", "The granite belt is looking a bit scorched."]
    }
  },
  {
    id: 'eungella',
    name: 'Eungella National Park',
    state: 'QLD',
    year: 2018,
    center: [-20.917, 148.583],
    zoom: 14,
    description: 'Tropical and subtropical rainforest on the Clarke Range inland from Mackay. Unprecedented fire penetration into wet sclerophyll driven by the longest recorded dry spell in the region.',
    areaHa: '9,000',
    risk: 'Extreme',
    image: eungella,
    introMessages: [
      "Tropical Eungella is having an 'unprecedented' bad day!",
      "Rainforest? It's more of a 'Fireforest' right now!",
      "Inland from Mackay and feeling the heat!",
      "Let's stop the fire from penetrating the wet sclerophyll!"
    ],
    mascotDialogue: {
      water: ["Water in the rainforest, as nature intended!", "Dousing the Clarke Range!", "Keep the wet sclerophyll wet!"],
      wind: ["The wind is making the fire spread through the canopy!", "Whoa, that's a tropical breeze!", "The Clarke Range wind is acting up!"],
      idle: ["I hope the platypuses in Eungella are okay.", "It's humid and hot... the worst combination.", "I think I saw a rare bird! Oh wait, just a flying ember.", "Is Mackay far from here? I'm hungry."],
      victory: ["Eungella is saved! The rainforest is safe once more!", "You're a tropical hero, Commander!"],
      defeat: ["The rainforest shouldn't burn like this. This is heartbreaking.", "The Clarke Range is feeling the burn."]
    }
  },
];

export default scenarios;
