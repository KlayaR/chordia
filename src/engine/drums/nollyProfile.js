/**
 * Nolly's velocity profile for GGD Modern & Massive 2 (ported from MidiHuman).
 *
 * Core principle: avoid 127. Real performances sit ~100-115 with headroom.
 * Each role has a target {vel center, spread jitter, hi hard max}.
 * Values marked (Nolly) are from his guide; the rest are interpolations.
 */

export const PROFILE_NAME = 'Nolly — GGD Modern & Massive 2'
export const VELOCITY_CEILING = 118

// role -> { vel (center), spread (jitter stddev), hi (hard per-role max) }
export const TARGETS = {
  kick:              { vel: 105, spread: 5, hi: 110 },   // (Nolly) 100-110
  snare_backbeat:    { vel: 115, spread: 4, hi: 116 },   // (Nolly) authoritative
  snare_accent:      { vel: 110, spread: 5, hi: 114 },
  snare_fill:        { vel: 100, spread: 6, hi: 106 },   // (Nolly) lighter wrist
  ghost:             { vel: 35,  spread: 5, hi: 42 },    // (Nolly) 30-40
  ruff:              { vel: 15,  spread: 4, hi: 22 },    // (Nolly) 10-20
  hat_closed:        { vel: 35,  spread: 5, hi: 42 },    // (Nolly) 30-40
  hat_closed_accent: { vel: 62,  spread: 6, hi: 74 },
  hat_open:          { vel: 102, spread: 5, hi: 108 },   // (Nolly) smooth sustain
  hat_pedal:         { vel: 40,  spread: 5, hi: 46 },
  crash:             { vel: 115, spread: 4, hi: 117 },   // (Nolly) powerful wash
  ride_bow:          { vel: 95,  spread: 6, hi: 103 },
  ride_bell:         { vel: 112, spread: 5, hi: 116 },
  tom_fast:          { vel: 95,  spread: 5, hi: 101 },   // (Nolly) <=100 fluid runs
  tom_open:          { vel: 112, spread: 6, hi: 116 },   // (Nolly) up to 115
}
const DEFAULT_TARGET = { vel: 100, spread: 6, hi: 112 }
export const target = (role) => TARGETS[role] || DEFAULT_TARGET

// timing feel: [lay_ms (>0 = behind the beat), feel_weight (push/pull strength)]
export const FEEL = {
  kick:              [0.0, 0.15],
  snare_backbeat:    [3.0, 1.00],
  snare_accent:      [2.0, 0.80],
  snare_fill:        [0.0, 0.30],
  ghost:             [5.0, 0.60],
  ruff:              [4.0, 0.50],
  hat_closed:        [-1.0, 0.30],
  hat_closed_accent: [-1.0, 0.30],
  hat_open:          [0.0, 0.30],
  hat_pedal:         [0.0, 0.20],
  crash:             [0.0, 0.20],
  ride_bow:          [2.0, 0.70],
  ride_bell:         [1.0, 0.60],
  tom_fast:          [0.0, 0.30],
  tom_open:          [0.0, 0.40],
}
const DEFAULT_FEEL = [0.0, 0.40]
export const feelOf = (role) => FEEL[role] || DEFAULT_FEEL

export const FEEL_MAX = 14.0
export const JITTER_MS = 3.0
export const JITTER_MAX = 7.0
export const ANCHOR_JITTER = 0.4
export const DRIFT_STEP = 2.2
export const DRIFT_DECAY = 0.78
export const DRIFT_MAX = 7.0

export const VEL_DRIFT_STEP = 2.0
export const VEL_DRIFT_DECAY = 0.80
export const VEL_DRIFT_MAX = 5.0
export const PREIMPACT_DIP = 0.88
export const PREIMPACT_WINDOW_BEATS = 1.0

export const KICK_SWING_MIN = 12.0
export const KICK_SWING_MAX = 18.0
export const KICK_TRIPLE_RISE = 14.0
export const TOM_HAND_ALT = 10.0
export const FILL_START = 92.0
export const FILL_FINAL = 115.0
export const UPWARD_JITTER = 0.35
