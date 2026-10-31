/**
 * Galaxy Hunter: Gourmet Odyssey - Unified Audio Bridge
 * Re-exports the high-fidelity procedural AudioManager from src/core/audio.js
 * and ensures backward compatibility for all game subsystems.
 */

import { AudioManager, audio } from './core/audio.js';

const play = (type, defaults, options = {}) => {
  audio.playSFX(type, { ...defaults, ...options });
};

// Gameplay systems use descriptive calls while the synth keeps a compact
// primitive palette. These aliases give every action its own timbre/cooldown.
audio.playFootstep = (options) => play('footstep', {
  pitch: 82,
  volume: 0.42,
  throttle: 115,
  cooldownKey: 'player_footstep'
}, options);
audio.playSlash = (comboStep = 1) => {
  const step = Math.max(1, Math.min(3, Number(comboStep) || 1));
  play('sword_slash', {
    pitch: [620, 535, 440][step - 1],
    duration: [0.12, 0.15, 0.21][step - 1],
    volume: [0.72, 0.84, 1][step - 1],
    throttle: 35,
    cooldownKey: `player_slash_${step}`
  });
};
audio.playCharge = (options) => play('sword_heavy', {
  pitch: 330,
  volume: 0.38,
  throttle: 120,
  cooldownKey: 'player_charge'
}, options);
audio.playHeavySmash = (options) => play('sword_heavy', {
  pitch: 175,
  volume: 0.95,
  throttle: 90,
  cooldownKey: 'heavy_smash'
}, options);
audio.playGuardUp = (options) => play('shield_parry', {
  pitch: 760,
  volume: 0.28,
  throttle: 80,
  cooldownKey: 'guard_up'
}, options);
audio.playDash = (options) => play('dash', {
  pitch: 1650,
  volume: 0.72,
  throttle: 90,
  cooldownKey: 'player_dash'
}, options);
audio.playParrySuccess = (options) => play('shield_parry', {
  pitch: 1320,
  volume: 1,
  throttle: 35,
  cooldownKey: 'perfect_parry'
}, options);
audio.playGuardBlock = (options) => play('hit_impact', {
  pitch: 310,
  volume: 0.7,
  throttle: 60,
  cooldownKey: 'guard_block'
}, options);
audio.playPlayerHurt = (options) => play('hit_impact', {
  pitch: 185,
  volume: 0.72,
  throttle: 100,
  cooldownKey: 'player_hurt'
}, options);
audio.playPlayerDeath = (options) => play('monster_roar', {
  pitch: 52,
  duration: 0.9,
  volume: 0.72,
  throttle: 500,
  cooldownKey: 'player_death'
}, options);

audio.playAlert = (options) => play('monster_roar', {
  pitch: 132,
  duration: 0.22,
  volume: 0.25,
  throttle: 260,
  cooldownKey: 'monster_alert'
}, options);
audio.playMonsterBite = (options) => play('hit_impact', {
  pitch: 145,
  volume: 0.62,
  throttle: 90,
  cooldownKey: 'monster_bite'
}, options);
audio.playMonsterHurt = (options) => play('hit_impact', {
  pitch: 235,
  volume: 0.48,
  throttle: 65,
  cooldownKey: 'monster_hurt'
}, options);
audio.playMonsterDeath = (options) => play('monster_roar', {
  pitch: 66,
  duration: 0.58,
  volume: 0.6,
  throttle: 120,
  cooldownKey: 'monster_death'
}, options);
audio.playSpit = (options) => play('sword_slash', {
  pitch: 860,
  duration: 0.09,
  volume: 0.38,
  throttle: 120,
  cooldownKey: 'monster_spit'
}, options);
audio.playDragonRoar = (options) => play('monster_roar', {
  pitch: 58,
  duration: 0.95,
  volume: 0.9,
  throttle: 650,
  cooldownKey: 'dragon_roar'
}, options);
audio.playFireBreath = (options) => play('cook_sizzle', {
  duration: 0.62,
  volume: 0.64,
  throttle: 180,
  cooldownKey: 'fire_breath'
}, options);
audio.playMammothStomp = (options) => play('sword_heavy', {
  pitch: 115,
  volume: 1,
  throttle: 240,
  cooldownKey: 'mammoth_stomp'
}, options);

audio.playChop = (options) => play('sword_slash', {
  pitch: 690,
  duration: 0.09,
  volume: 0.38,
  throttle: 55,
  cooldownKey: 'cooking_chop'
}, options);
audio.playSizzle = (options) => play('cook_sizzle', {
  volume: 0.55,
  cooldownKey: 'cooking_sizzle'
}, options);
audio.playCoin = (options) => play('item_pickup', {
  volume: 0.7,
  cooldownKey: 'reward_coin'
}, options);
audio.playSparkle = (options) => play('level_up', {
  volume: 0.68,
  cooldownKey: 'reward_sparkle'
}, options);
audio.playStarFanfare = (options) => play('cook_fanfare', {
  volume: 0.8,
  cooldownKey: 'cooking_fanfare'
}, options);

export { AudioManager, audio };
export const sound = audio;
export default audio;
