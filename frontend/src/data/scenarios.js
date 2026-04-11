import blueMountains from '../assets/blue-mountains.jpg';
import daguilar from '../assets/D\'Aguilar.jpg';
import grampians from '../assets/Grampians.jpg';
import kangarooIsland from '../assets/KangarooIsland.jpg';
import lamington from '../assets/Lamington-National-Park.jpg';
import dandenong from '../assets/Mt_Dandenong_from_Mooroolbark.jpg';

export const RISK_LEVELS = {
  Catastrophic: { label: 'Catastrophic', color: 'text-red-400', bg: 'bg-red-950 border-red-800' },
  Extreme:      { label: 'Extreme',      color: 'text-orange-400', bg: 'bg-orange-950 border-orange-800' },
  High:         { label: 'High',         color: 'text-amber-400', bg: 'bg-amber-950 border-amber-800' },
};

const scenarios = [
  {
    id: 'blue-mountains',
    name: 'Blue Mountains',
    state: 'NSW',
    year: 2019,
    center: [-33.6484, 150.3118],
    zoom: 17,
    description: 'Eucalypt forest fire across the Greater Blue Mountains Heritage Area. High-speed fire fronts driven by westerly winds toward escarpment communities.',
    areaHa: '45,000',
    risk: 'Extreme',
    image: blueMountains,
  },
  {
    id: 'daguilar',
    name: "D'Aguilar National Park",
    state: 'QLD',
    year: 2023,
    center: [-27.291, 152.8196],
    zoom: 17,
    description: 'Subtropical dry sclerophyll forest north-west of Brisbane. Dry lightning ignition with complex terrain channelling wind through ridge lines.',
    areaHa: '22,000',
    risk: 'High',
    image: daguilar,
  },
  {
    id: 'grampians',
    name: 'Grampians (Gariwerd)',
    state: 'VIC',
    year: 2006,
    center: [-37.15, 142.499],
    zoom: 17,
    description: 'Extensive woodland and heath across the Grampians ranges. Strong northerly winds during heatwave drove fire deep into the national park.',
    areaHa: '130,000',
    risk: 'Extreme',
    image: grampians,
  },
  {
    id: 'kangaroo-island',
    name: 'Kangaroo Island',
    state: 'SA',
    year: 2019,
    center: [-35.8516, 137.2072],
    zoom: 17,
    description: 'Dense native scrub across southern island habitat. Lightning strike ignition during extreme heatwave conditions devastated wildlife refuges.',
    areaHa: '211,000',
    risk: 'Catastrophic',
    image: kangarooIsland,
  },
  {
    id: 'lamington',
    name: 'Lamington National Park',
    state: 'QLD',
    year: 2019,
    center: [-28.231, 153.1196],
    zoom: 17,
    description: 'Subtropical rainforest–eucalypt interface in the McPherson Range. Rapid boundary flare-ups and spotting across deep valleys from ember cast.',
    areaHa: '6,000',
    risk: 'High',
    image: lamington,
  },
  {
    id: 'dandenong',
    name: 'Dandenong Ranges',
    state: 'VIC',
    year: 2009,
    center: [-37.858, 145.359],
    zoom: 17,
    description: 'Mountain ash forest on Melbourne\'s urban fringe. Complex wind channelling through deep gullies created unpredictable fire behaviour near communities.',
    areaHa: '18,000',
    risk: 'Extreme',
    image: dandenong,
  },
];

export default scenarios;
