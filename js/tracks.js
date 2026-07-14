import { SURFACE } from './utils.js';

function makeTrack(config) {
  return {
    name: config.name,
    description: config.description,
    surfaces: config.surfaces,
    walls: config.walls,
    checkpoints: config.checkpoints,
    waypoints: config.waypoints,
    starts: config.starts,
    decorations: config.decorations || [],
  };
}

export const TRACKS = [
  makeTrack({
    name: 'Neon Circuit Alpha',
    description: 'Training grid — master the hover controls.',
    surfaces: [
      { type: 'GRASS', x: 0, y: 0, w: 960, h: 640 },
      { type: 'DIRT', x: 180, y: 120, w: 600, h: 400 },
      { type: 'MUD', x: 420, y: 280, w: 120, h: 80 },
    ],
    walls: [
      { x: 160, y: 100, w: 640, h: 20 },
      { x: 160, y: 520, w: 640, h: 20 },
      { x: 160, y: 100, w: 20, h: 440 },
      { x: 780, y: 100, w: 20, h: 440 },
      { x: 300, y: 260, w: 60, h: 20 },
      { x: 600, y: 360, w: 60, h: 20 },
    ],
    checkpoints: [
      { x: 480, y: 500, radius: 50 },
      { x: 200, y: 300, radius: 50 },
      { x: 760, y: 300, radius: 50 },
      { x: 480, y: 130, radius: 50 },
    ],
    waypoints: [
      { x: 480, y: 480 }, { x: 220, y: 400 }, { x: 200, y: 300 },
      { x: 220, y: 200 }, { x: 480, y: 150 }, { x: 740, y: 200 },
      { x: 760, y: 300 }, { x: 740, y: 400 }, { x: 480, y: 480 },
    ],
    starts: [
      { x: 440, y: 460, angle: -Math.PI / 2 },
      { x: 460, y: 470, angle: -Math.PI / 2 },
      { x: 480, y: 480, angle: -Math.PI / 2 },
      { x: 500, y: 470, angle: -Math.PI / 2 },
    ],
    decorations: [
      { type: 'beacon', x: 140, y: 140 }, { type: 'beacon', x: 800, y: 140 },
      { type: 'hologram', x: 480, y: 90 },
    ],
  }),

  makeTrack({
    name: 'Plasma Swamp Sector',
    description: 'Energy drain zones will cripple your thrusters.',
    surfaces: [
      { type: 'GRASS', x: 0, y: 0, w: 960, h: 640 },
      { type: 'DIRT', x: 120, y: 80, w: 720, h: 480 },
      { type: 'MUD', x: 380, y: 240, w: 200, h: 160 },
      { type: 'WATER', x: 430, y: 290, w: 100, h: 60 },
      { type: 'ASPHALT', x: 120, y: 280, w: 80, h: 80 },
      { type: 'ASPHALT', x: 760, y: 280, w: 80, h: 80 },
    ],
    walls: [
      { x: 100, y: 60, w: 760, h: 20 },
      { x: 100, y: 560, w: 760, h: 20 },
      { x: 100, y: 60, w: 20, h: 520 },
      { x: 840, y: 60, w: 20, h: 520 },
      { x: 340, y: 200, w: 20, h: 80 },
      { x: 600, y: 360, w: 20, h: 80 },
      { x: 340, y: 360, w: 280, h: 20 },
    ],
    checkpoints: [
      { x: 480, y: 520, radius: 55 },
      { x: 160, y: 320, radius: 50 },
      { x: 480, y: 160, radius: 55 },
      { x: 800, y: 320, radius: 50 },
    ],
    waypoints: [
      { x: 480, y: 500 }, { x: 180, y: 450 }, { x: 160, y: 320 },
      { x: 180, y: 180 }, { x: 480, y: 140 }, { x: 780, y: 180 },
      { x: 800, y: 320 }, { x: 780, y: 460 }, { x: 480, y: 500 },
    ],
    starts: [
      { x: 420, y: 490, angle: -Math.PI / 2 },
      { x: 445, y: 500, angle: -Math.PI / 2 },
      { x: 470, y: 510, angle: -Math.PI / 2 },
      { x: 495, y: 500, angle: -Math.PI / 2 },
    ],
  }),

  makeTrack({
    name: 'Quantum Crossover',
    description: 'Cross the energy bridge at maximum velocity.',
    surfaces: [
      { type: 'GRASS', x: 0, y: 0, w: 960, h: 640 },
      { type: 'DIRT', x: 80, y: 60, w: 380, h: 260 },
      { type: 'DIRT', x: 500, y: 60, w: 380, h: 260 },
      { type: 'DIRT', x: 80, y: 320, w: 380, h: 260 },
      { type: 'DIRT', x: 500, y: 320, w: 380, h: 260 },
      { type: 'ASPHALT', x: 420, y: 280, w: 120, h: 80 },
      { type: 'MUD', x: 200, y: 420, w: 100, h: 80 },
      { type: 'MUD', x: 660, y: 140, w: 100, h: 80 },
    ],
    walls: [
      { x: 60, y: 40, w: 420, h: 20 }, { x: 480, y: 40, w: 420, h: 20 },
      { x: 60, y: 300, w: 420, h: 20 }, { x: 480, y: 300, w: 420, h: 20 },
      { x: 60, y: 560, w: 420, h: 20 }, { x: 480, y: 560, w: 420, h: 20 },
      { x: 60, y: 40, w: 20, h: 280 }, { x: 60, y: 300, w: 20, h: 280 },
      { x: 880, y: 40, w: 20, h: 280 }, { x: 880, y: 300, w: 20, h: 280 },
      { x: 460, y: 40, w: 20, h: 240 }, { x: 460, y: 360, w: 20, h: 240 },
    ],
    checkpoints: [
      { x: 260, y: 500, radius: 50 },
      { x: 700, y: 500, radius: 50 },
      { x: 700, y: 140, radius: 50 },
      { x: 260, y: 140, radius: 50 },
      { x: 480, y: 320, radius: 45 },
    ],
    waypoints: [
      { x: 260, y: 480 }, { x: 260, y: 340 }, { x: 260, y: 160 },
      { x: 480, y: 160 }, { x: 700, y: 160 }, { x: 700, y: 340 },
      { x: 700, y: 480 }, { x: 480, y: 480 }, { x: 260, y: 480 },
    ],
    starts: [
      { x: 220, y: 470, angle: -Math.PI / 2 },
      { x: 245, y: 480, angle: -Math.PI / 2 },
      { x: 270, y: 490, angle: -Math.PI / 2 },
      { x: 295, y: 480, angle: -Math.PI / 2 },
    ],
  }),

  makeTrack({
    name: 'Void Canyon Run',
    description: 'Tight vector turns and a long plasma straight.',
    surfaces: [
      { type: 'GRASS', x: 0, y: 0, w: 960, h: 640 },
      { type: 'DIRT', x: 100, y: 200, w: 760, h: 240 },
      { type: 'ASPHALT', x: 100, y: 280, w: 300, h: 80 },
      { type: 'MUD', x: 500, y: 220, w: 80, h: 200 },
      { type: 'MUD', x: 680, y: 220, w: 80, h: 200 },
    ],
    walls: [
      { x: 80, y: 180, w: 800, h: 20 },
      { x: 80, y: 440, w: 800, h: 20 },
      { x: 80, y: 180, w: 20, h: 280 },
      { x: 860, y: 180, w: 20, h: 280 },
      { x: 400, y: 200, w: 20, h: 60 },
      { x: 540, y: 380, w: 20, h: 60 },
      { x: 620, y: 200, w: 20, h: 60 },
    ],
    checkpoints: [
      { x: 140, y: 320, radius: 50 },
      { x: 420, y: 320, radius: 50 },
      { x: 820, y: 320, radius: 50 },
      { x: 500, y: 220, radius: 45 },
    ],
    waypoints: [
      { x: 140, y: 320 }, { x: 300, y: 320 }, { x: 420, y: 320 },
      { x: 560, y: 300 }, { x: 720, y: 320 }, { x: 820, y: 320 },
      { x: 720, y: 320 }, { x: 560, y: 340 }, { x: 420, y: 320 },
      { x: 300, y: 320 }, { x: 140, y: 320 },
    ],
    starts: [
      { x: 120, y: 350, angle: 0 },
      { x: 120, y: 330, angle: 0 },
      { x: 120, y: 310, angle: 0 },
      { x: 120, y: 290, angle: 0 },
    ],
  }),

  makeTrack({
    name: 'Singularity Grand Prix',
    description: 'The final gate. Every hazard, every surface, one champion.',
    surfaces: [
      { type: 'GRASS', x: 0, y: 0, w: 960, h: 640 },
      { type: 'DIRT', x: 140, y: 100, w: 680, h: 440 },
      { type: 'ASPHALT', x: 140, y: 280, w: 200, h: 80 },
      { type: 'ASPHALT', x: 620, y: 280, w: 200, h: 80 },
      { type: 'MUD', x: 400, y: 160, w: 160, h: 100 },
      { type: 'MUD', x: 400, y: 380, w: 160, h: 100 },
      { type: 'WATER', x: 440, y: 280, w: 80, h: 80 },
    ],
    walls: [
      { x: 120, y: 80, w: 720, h: 20 },
      { x: 120, y: 540, w: 720, h: 20 },
      { x: 120, y: 80, w: 20, h: 480 },
      { x: 820, y: 80, w: 20, h: 480 },
      { x: 360, y: 140, w: 20, h: 80 },
      { x: 580, y: 140, w: 20, h: 80 },
      { x: 360, y: 420, w: 20, h: 80 },
      { x: 580, y: 420, w: 20, h: 80 },
      { x: 360, y: 280, w: 80, h: 20 },
      { x: 520, y: 340, w: 80, h: 20 },
    ],
    checkpoints: [
      { x: 480, y: 510, radius: 55 },
      { x: 180, y: 320, radius: 50 },
      { x: 480, y: 130, radius: 55 },
      { x: 780, y: 320, radius: 50 },
      { x: 480, y: 320, radius: 40 },
    ],
    waypoints: [
      { x: 480, y: 490 }, { x: 200, y: 420 }, { x: 180, y: 320 },
      { x: 200, y: 200 }, { x: 400, y: 150 }, { x: 560, y: 150 },
      { x: 760, y: 200 }, { x: 780, y: 320 }, { x: 760, y: 440 },
      { x: 560, y: 490 }, { x: 400, y: 490 }, { x: 480, y: 490 },
    ],
    starts: [
      { x: 440, y: 470, angle: -Math.PI / 2 },
      { x: 460, y: 480, angle: -Math.PI / 2 },
      { x: 480, y: 490, angle: -Math.PI / 2 },
      { x: 500, y: 480, angle: -Math.PI / 2 },
    ],
    decorations: [
      { type: 'energy_node', x: 480, y: 60 },
      { type: 'beacon', x: 130, y: 530 },
      { type: 'beacon', x: 810, y: 530 },
    ],
  }),
];

export function getSurfaceAt(track, x, y) {
  for (let i = track.surfaces.length - 1; i >= 0; i--) {
    const s = track.surfaces[i];
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
      return s.type;
    }
  }
  return 'GRASS';
}
