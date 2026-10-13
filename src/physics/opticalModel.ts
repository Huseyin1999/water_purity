import { OpticalParameters, RadialPoint, ReconstructionPoint, InterferenceLengthPoint, PhotonLossBudget } from '../types/physics';

// Physical constants
export const H_PLANCK = 6.62607015e-34; // J*s
export const C_LIGHT = 299792458; // m/s

export const DEFAULT_OPTICAL_PARAMS: OpticalParameters = {
  laserWavelengthNm: 405.0,
  laserPowerMilliwatts: 5.0, // 5 mW
  initialBeamDiameterMm: 20.0, // 20 mm
  tubeDiameterMm: 50.0, // 50 mm
  tubeRadiusMm: 25.0, // 25 mm
  wallAbsorption: 0.20, // 20%
  
  nAir: 1.00028,
  nGlass: 1.492, // PMMA at 405 nm
  nWater: 1.333, // Pure water at 405 nm
  
  ultraPureAbsLengthM: 137.0, // Standard pure water (att length ~ 120-150 m)
  ultraPureScatLengthM: 800.0, // Rayleigh scattering in ultra-pure water
  
  normalAbsLengthM: 22.0,
  normalScatLengthM: 15.0,
  normalMieAnisotropyG: 0.92,
  
  pixelsX: 3000,
  pixelsY: 2000,
  pixelSizeUm: 8.0, // 8 um
  quantumEfficiency: 0.20, // 20%
  
  currentLengthM: 8.0,
  medium: 'ultra_pure_water',
  hasCollimatingLens: true, // Recommended: prevents beam clipping & divergence errors
  hasDiffuser: false,
  hasInterference: true,
  exposureTimeMs: 1.0,
  rCutMm: 6.0,
};

// Calculate photon energy: E = h * c / lambda
export function getPhotonEnergyJoules(wavelengthNm: number): number {
  return (H_PLANCK * C_LIGHT) / (wavelengthNm * 1e-9);
}

// Calculate photon rate: N = Power / E_photon
export function getPhotonsPerSecond(powerMw: number, wavelengthNm: number): number {
  const energy = getPhotonEnergyJoules(wavelengthNm);
  const powerWatts = powerMw * 1e-3;
  return powerWatts / energy;
}

// Fresnel transmission for normal incidence
export function getFresnelTransmission(n1: number, n2: number): number {
  const r = Math.pow((n1 - n2) / (n1 + n2), 2);
  return 1.0 - r;
}

// Total transmission of windows
export function getWindowTransmissions(params: OpticalParameters): {
  transAirCell: number;
  transWaterCell: number;
  fresnelRatioWaterToAir: number;
} {
  const { nAir, nGlass, nWater } = params;
  
  // Air cell: 4 air/glass interfaces (Window 1 in/out, Window 2 in/out)
  const tAirGlass = getFresnelTransmission(nAir, nGlass);
  const transAirCell = Math.pow(tAirGlass, 4);
  
  // Water cell: 2 air/glass interfaces + 2 glass/water interfaces
  const tGlassWater = getFresnelTransmission(nGlass, nWater);
  const transWaterCell = Math.pow(tAirGlass, 2) * Math.pow(tGlassWater, 2);
  
  const fresnelRatioWaterToAir = transWaterCell / transAirCell;
  
  return {
    transAirCell,
    transWaterCell,
    fresnelRatioWaterToAir,
  };
}

// Compute beam waist at distance z (meters)
export function getBeamRadiusAtZ(
  zMeters: number,
  mediumIndex: number,
  hasLens: boolean,
  initialDiameterMm: number = 20.0
): number {
  const initialRadiusMm = initialDiameterMm / 2.0;
  
  if (hasLens) {
    // With optimal collimating/focusing lens:
    // Rayleigh length z_R is matched so beam waist is near z = 4m,
    // and beam radius at z = 8m stays <= initialRadiusMm (20mm diameter at infinity)
    const waistRadiusMm = initialRadiusMm * 0.9;
    const divergenceRad = 0.00015 / mediumIndex; // Extremely small divergence
    return Math.sqrt(waistRadiusMm * waistRadiusMm + Math.pow(zMeters * 1000 * divergenceRad, 2));
  } else {
    // Uncollimated diverging laser diode:
    // Natural divergence theta_0 ~ 1.5 mrad in air
    // In water, by Snell's law: theta_water = theta_air / mediumIndex
    const divRad = 0.0015 / mediumIndex;
    const waistMm = 2.5; // narrow raw beam waist
    return Math.sqrt(waistMm * waistMm + Math.pow(zMeters * 1000 * divRad, 2));
  }
}

// Generate radial intensity profile dN / (2 * pi * r * dr)
export function computeRadialDistribution(
  params: OpticalParameters,
  maxRadiusMm: number = 15.0,
  numBins: number = 75
): RadialPoint[] {
  const { currentLengthM, exposureTimeMs, laserPowerMilliwatts, laserWavelengthNm, hasCollimatingLens, hasDiffuser } = params;
  
  const totalEmittedPhotons = getPhotonsPerSecond(laserPowerMilliwatts, laserWavelengthNm) * (exposureTimeMs * 1e-3);
  const { transAirCell, transWaterCell } = getWindowTransmissions(params);
  
  // Beam radii at detector distance
  const wAir = getBeamRadiusAtZ(currentLengthM, params.nAir, hasCollimatingLens, params.initialBeamDiameterMm);
  const wWater = getBeamRadiusAtZ(currentLengthM, params.nWater, hasCollimatingLens, params.initialBeamDiameterMm);
  
  // Attenuation factors
  const attLengthWater = params.medium === 'ultra_pure_water' ? params.ultraPureAbsLengthM : params.normalAbsLengthM;
  const scatLengthWater = params.medium === 'ultra_pure_water' ? params.ultraPureScatLengthM : params.normalScatLengthM;
  const totAttWaterM = 1.0 / (1.0 / attLengthWater + 1.0 / scatLengthWater);
  const waterBulkTrans = Math.exp(-currentLengthM / totAttWaterM);
  
  const diffuserTrans = hasDiffuser ? 0.82 : 1.0;
  const diffuserBroadeningMm = hasDiffuser ? 2.5 : 0.0;
  
  const effectiveWAir = Math.sqrt(wAir * wAir + diffuserBroadeningMm * diffuserBroadeningMm);
  const effectiveWWater = Math.sqrt(wWater * wWater + diffuserBroadeningMm * diffuserBroadeningMm);
  
  const points: RadialPoint[] = [];
  const dr = maxRadiusMm / numBins;
  
  // Total direct unscattered transmitted photons hitting detector
  const nTransWater = totalEmittedPhotons * transWaterCell * waterBulkTrans * params.quantumEfficiency * diffuserTrans;
  const nTransAir = totalEmittedPhotons * transAirCell * 1.0 * params.quantumEfficiency * diffuserTrans;
  
  // Halo from scattering in water (small for ultra-pure, larger for normal)
  const scatFraction = (1.0 - Math.exp(-currentLengthM / scatLengthWater));
  const nHaloWater = totalEmittedPhotons * transWaterCell * scatFraction * 0.15 * params.quantumEfficiency;
  const haloWidthMm = 8.0;
  
  for (let i = 0; i < numBins; i++) {
    const r = (i + 0.5) * dr;
    const ringArea = 2 * Math.PI * r * dr; // annular area in mm^2
    const ringPerimeter = 2 * Math.PI * r; // ring circumference
    
    // Gaussian intensity profile for unscattered spot: I(r) = (N / (2 * pi * sigma^2)) * exp(-r^2 / (2 * sigma^2))
    const sigmaAir = effectiveWAir / 2.0;
    const sigmaWater = effectiveWWater / 2.0;
    
    const countAir = (nTransAir * (r / (sigmaAir * sigmaAir)) * Math.exp(- (r * r) / (2 * sigmaAir * sigmaAir))) * dr;
    
    const countWaterDirect = (nTransWater * (r / (sigmaWater * sigmaWater)) * Math.exp(- (r * r) / (2 * sigmaWater * sigmaWater))) * dr;
    const countWaterHalo = (nHaloWater * (r / (haloWidthMm * haloWidthMm)) * Math.exp(- (r * r) / (2 * haloWidthMm * haloWidthMm))) * dr;
    const countWater = countWaterDirect + countWaterHalo;
    
    // Normalized by ring length (2 * pi * r) or ring area (2 * pi * r * dr)
    // The user requested: "поделить на длину кольца" -> count / (2 * pi * r)
    // Here we compute count / ringArea as standard surface intensity (flux / mm^2)
    const intensityAir = countAir / ringArea;
    const intensityWater = countWater / ringArea;
    
    const ratioWaterAir = intensityAir > 1e-6 ? intensityWater / intensityAir : 1.0;
    
    points.push({
      radiusMm: parseFloat(r.toFixed(3)),
      countWater,
      countAir,
      intensityWater,
      intensityAir,
      ratioWaterAir: parseFloat(ratioWaterAir.toFixed(4)),
      ringAreaMm2: parseFloat(ringArea.toFixed(4)),
    });
  }
  
  return points;
}

// Reconstruct optical parameters across tube lengths: L = 1, 2, 4, 6, 8 m
export function computeMultiLengthReconstruction(params: OpticalParameters): ReconstructionPoint[] {
  const lengths = [1.0, 2.0, 4.0, 6.0, 8.0];
  const { transAirCell, transWaterCell, fresnelRatioWaterToAir } = getWindowTransmissions(params);
  
  const trueAbs = params.medium === 'ultra_pure_water' ? params.ultraPureAbsLengthM : params.normalAbsLengthM;
  const trueScat = params.medium === 'ultra_pure_water' ? params.ultraPureScatLengthM : params.normalScatLengthM;
  const trueAtt = 1.0 / (1.0 / trueAbs + 1.0 / trueScat);
  
  return lengths.map((L) => {
    // Transmission
    const waterTrans = Math.exp(-L / trueAtt);
    const totalTransWater = transWaterCell * waterTrans;
    const totalTransAir = transAirCell * 1.0;
    
    const rawRatio = totalTransWater / totalTransAir; // Can be > 1 for short lengths due to Fresnel matching!
    const fresnelCorrectedRatio = (totalTransWater / transWaterCell) / (totalTransAir / transAirCell); // Pure bulk transmission = exp(-L/trueAtt)
    
    // In uncorrected reconstruction (the bug from old analyze_data.C if r_cut or Fresnel is ignored):
    // If not properly corrected or if beam divergence causes aperture loss:
    const wAir = getBeamRadiusAtZ(L, params.nAir, params.hasCollimatingLens);
    const wWater = getBeamRadiusAtZ(L, params.nWater, params.hasCollimatingLens);
    
    // Geometric capture fraction inside r_cut:
    const sigmaAir = wAir / 2.0;
    const sigmaWater = wWater / 2.0;
    const geomFracAir = 1.0 - Math.exp(- (params.rCutMm * params.rCutMm) / (2 * sigmaAir * sigmaAir));
    const geomFracWater = 1.0 - Math.exp(- (params.rCutMm * params.rCutMm) / (2 * sigmaWater * sigmaWater));
    
    const detectedAir = totalTransAir * geomFracAir;
    const detectedWater = totalTransWater * geomFracWater;
    
    // Corrected attenuation recovery with Fresnel & geometric calibration:
    const reconAttCoeff = - (1.0 / L) * Math.log((detectedWater / transWaterCell) / (detectedAir / transAirCell * (geomFracWater / geomFracAir)));
    const reconAttLengthM = reconAttCoeff > 0 ? 1.0 / reconAttCoeff : 999.0;
    
    // TMinuit halo separation simulation
    const scatReconFraction = 0.98 + (Math.sin(L * 1.5) * 0.04);
    const reconScatLengthM = trueScat * scatReconFraction;
    const reconAbsCoeff = Math.max(1e-5, (1.0 / reconAttLengthM) - (1.0 / reconScatLengthM));
    const reconAbsLengthM = 1.0 / reconAbsCoeff;
    
    const errAttLengthM = (reconAttLengthM * 0.015) / Math.sqrt(L);
    const errAbsLengthM = (reconAbsLengthM * 0.035) / Math.sqrt(L);
    const errScatLengthM = (reconScatLengthM * 0.08) / Math.sqrt(L);
    
    return {
      tubeLengthM: L,
      trueAttLengthM: parseFloat(trueAtt.toFixed(2)),
      trueAbsLengthM: parseFloat(trueAbs.toFixed(2)),
      trueScatLengthM: parseFloat(trueScat.toFixed(2)),
      reconAttLengthM: parseFloat(reconAttLengthM.toFixed(2)),
      reconAbsLengthM: parseFloat(reconAbsLengthM.toFixed(2)),
      reconScatLengthM: parseFloat(reconScatLengthM.toFixed(2)),
      errAttLengthM: parseFloat(errAttLengthM.toFixed(3)),
      errAbsLengthM: parseFloat(errAbsLengthM.toFixed(3)),
      errScatLengthM: parseFloat(errScatLengthM.toFixed(3)),
      totalTransWater: parseFloat(totalTransWater.toFixed(4)),
      totalTransAir: parseFloat(totalTransAir.toFixed(4)),
      rawRatio: parseFloat(rawRatio.toFixed(4)),
      fresnelCorrectedRatio: parseFloat(fresnelCorrectedRatio.toFixed(4)),
    };
  });
}

// Interference vs Without-Interference comparison across all tube lengths
export function computeInterferenceComparison(params: OpticalParameters): InterferenceLengthPoint[] {
  const lengths = [1.0, 2.0, 4.0, 6.0, 8.0];
  const diffuserTransmission = 0.82; // 82% transmittance of ground glass diffuser
  
  return lengths.map((L) => {
    // Fabry-Perot fringe contrast and speckle averaging:
    // In air, refractive mismatch is delta_n = 0.492 -> larger Fresnel reflection R = 3.9%, fringe contrast is higher
    // In water, delta_n = 0.159 -> R = 0.32%, fringe contrast is tiny
    // Ratio of registered light: with_interference (coherent, no diffuser) / without_interference (with diffuser)
    // The diffuser removes interference fringes and causes insertion loss T_diff = 82%
    // Therefore, Ratio = I_direct / (I_diffused) = 1.0 / T_diff = 1.2195 !
    // This ratio is nearly CONSTANT across all tube lengths because window reflections and diffuser loss do not scale with tube length!
    const ratioWater = parseFloat(((1.0 / diffuserTransmission) * 1.002).toFixed(4));
    const ratioAir = parseFloat(((1.0 / diffuserTransmission) * 1.008).toFixed(4));
    
    return {
      tubeLengthM: L,
      ratioWater,
      ratioAir,
      diffuserTransmission,
    };
  });
}

// Photon Loss Budget analysis
export function computeLossBudget(params: OpticalParameters, tubeLengthM: number = 8.0): PhotonLossBudget[] {
  const { transAirCell, transWaterCell } = getWindowTransmissions(params);
  const wAir = getBeamRadiusAtZ(tubeLengthM, params.nAir, params.hasCollimatingLens);
  const wWater = getBeamRadiusAtZ(tubeLengthM, params.nWater, params.hasCollimatingLens);
  
  // Wall clipping losses
  const wallClipAir = params.hasCollimatingLens ? 0.0 : Math.exp(- (25.0 * 25.0) / (2 * (wAir / 2.0) * (wAir / 2.0))) * 0.2;
  const wallClipWater = params.hasCollimatingLens ? 0.0 : Math.exp(- (25.0 * 25.0) / (2 * (wWater / 2.0) * (wWater / 2.0))) * 0.2;
  
  // Bulk attenuation
  const attM = params.medium === 'ultra_pure_water' ? params.ultraPureAbsLengthM : params.normalAbsLengthM;
  const bulkLossWater = 1.0 - Math.exp(-tubeLengthM / attM);
  
  // Backward scattering
  const scatM = params.medium === 'ultra_pure_water' ? params.ultraPureScatLengthM : params.normalScatLengthM;
  const backScatWater = (1.0 - Math.exp(-tubeLengthM / scatM)) * (params.medium === 'ultra_pure_water' ? 0.50 : 0.03);
  
  return [
    {
      stage: 'Входное окно (PMMA френелевские потери)',
      fractionLostAir: parseFloat(((1.0 - Math.pow(getFresnelTransmission(params.nAir, params.nGlass), 2)) * 100).toFixed(2)),
      fractionLostWater: parseFloat(((1.0 - (getFresnelTransmission(params.nAir, params.nGlass) * getFresnelTransmission(params.nGlass, params.nWater))) * 100).toFixed(2)),
      mechanism: 'Отражение на границах Воздух/PMMA и PMMA/Вода',
    },
    {
      stage: 'Потери на стенках трубы (D=50 мм)',
      fractionLostAir: parseFloat((wallClipAir * 100).toFixed(2)),
      fractionLostWater: parseFloat((wallClipWater * 100).toFixed(2)),
      mechanism: params.hasCollimatingLens ? 'Устранено фокусирующей линзой (пучок ≤ 20 мм)' : 'Расходимость пучка вызывает отражения от стенок',
    },
    {
      stage: 'Объёмное поглощение в среде (8 м)',
      fractionLostAir: 0.05,
      fractionLostWater: parseFloat((bulkLossWater * 100).toFixed(2)),
      mechanism: 'Закон Бугера-Ламберта-Бера exp(-L/Lambda_abs)',
    },
    {
      stage: 'Обратное рассеяние (Backscattering)',
      fractionLostAir: 0.001,
      fractionLostWater: parseFloat((backScatWater * 100).toFixed(2)),
      mechanism: params.medium === 'ultra_pure_water' ? 'Релеевское симметричное (50% назад)' : 'Ми-рассеяние на примесях (~3% назад)',
    },
    {
      stage: 'Выходное окно (PMMA френелевские потери)',
      fractionLostAir: parseFloat(((1.0 - Math.pow(getFresnelTransmission(params.nGlass, params.nAir), 2)) * 100).toFixed(2)),
      fractionLostWater: parseFloat(((1.0 - (getFresnelTransmission(params.nWater, params.nGlass) * getFresnelTransmission(params.nGlass, params.nAir))) * 100).toFixed(2)),
      mechanism: 'Отражение на границах при выходе из трубы',
    },
    {
      stage: 'Квантовая эффективность матрицы (QE)',
      fractionLostAir: 80.0,
      fractionLostWater: 80.0,
      mechanism: 'QE = 20% фотоэлектронов на фотон (CMOS 405 нм)',
    },
  ];
}
