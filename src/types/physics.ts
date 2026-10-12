export interface OpticalParameters {
  laserWavelengthNm: number; // default 405 nm
  laserPowerMilliwatts: number; // default 5 mW
  initialBeamDiameterMm: number; // default 20 mm
  tubeDiameterMm: number; // default 50 mm
  tubeRadiusMm: number; // default 25 mm
  wallAbsorption: number; // 0.20 (20%)
  
  // Indices of refraction
  nAir: number; // 1.0003
  nGlass: number; // 1.492 (PMMA)
  nWater: number; // 1.333
  
  // Attenuation properties for ultra-pure water at 405 nm
  ultraPureAbsLengthM: number; // ~140 m
  ultraPureScatLengthM: number; // ~1000 m (Rayleigh only)
  
  // Normal water comparison
  normalAbsLengthM: number; // ~20 m
  normalScatLengthM: number; // ~15 m (Rayleigh + Mie)
  normalMieAnisotropyG: number; // ~0.92
  
  // Detector parameters
  pixelsX: number; // 3000
  pixelsY: number; // 2000
  pixelSizeUm: number; // 8 um (0.008 mm)
  quantumEfficiency: number; // 0.20 (20%)
  
  // Selected tube length
  currentLengthM: number; // 1, 2, 4, 6, 8
  
  // Flags & toggles
  medium: 'ultra_pure_water' | 'normal_water' | 'air';
  hasCollimatingLens: boolean;
  hasDiffuser: boolean; // Ground glass diffuser
  hasInterference: boolean; // Laser coherence / Fabry-Perot interference
  exposureTimeMs: 1.0 | 0.125;
  rCutMm: number; // Central spot cut radius
}

export interface RadialPoint {
  radiusMm: number;
  countWater: number;
  countAir: number;
  intensityWater: number; // count / (2 * pi * r * dr)
  intensityAir: number; // count / (2 * pi * r * dr)
  ratioWaterAir: number; // intensityWater / intensityAir
  ringAreaMm2: number;
}

export interface ReconstructionPoint {
  tubeLengthM: number;
  trueAttLengthM: number;
  trueAbsLengthM: number;
  trueScatLengthM: number;
  reconAttLengthM: number;
  reconAbsLengthM: number;
  reconScatLengthM: number;
  errAttLengthM: number;
  errAbsLengthM: number;
  errScatLengthM: number;
  totalTransWater: number;
  totalTransAir: number;
  rawRatio: number;
  fresnelCorrectedRatio: number;
}

export interface InterferenceLengthPoint {
  tubeLengthM: number;
  ratioWater: number; // with_interference / without_interference in water
  ratioAir: number; // with_interference / without_interference in air
  diffuserTransmission: number;
}

export interface PhotonLossBudget {
  stage: string;
  fractionLostAir: number;
  fractionLostWater: number;
  mechanism: string;
}
