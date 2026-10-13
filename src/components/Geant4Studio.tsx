import React, { useState } from 'react';
import { Atom, Copy, Check, Download, Terminal, Layers, FileCode, CheckCircle2 } from 'lucide-react';

export const Geant4Studio: React.FC = () => {
  const [activeFile, setActiveFile] = useState<'DetectorConstruction' | 'PrimaryGenerator' | 'PhysicsList' | 'run_mac' | 'CMakeLists'>('DetectorConstruction');
  const [copied, setCopied] = useState(false);

  const codeDetectorConstruction = `// =============================================================================
// GEANT4 SIMULATION FOR TAIGA EXPERIMENT WATER TEST BENCH
// DetectorConstruction.cc — Optical geometry, materials, PMMA windows & surfaces
// =============================================================================

#include "DetectorConstruction.hh"
#include "G4Material.hh"
#include "G4MaterialPropertiesTable.hh"
#include "G4NistManager.hh"
#include "G4Box.hh"
#include "G4Tubs.hh"
#include "G4LogicalVolume.hh"
#include "G4PVPlacement.hh"
#include "G4OpticalSurface.hh"
#include "G4LogicalBorderSurface.hh"
#include "G4LogicalSkinSurface.hh"
#include "G4SystemOfUnits.hh"

DetectorConstruction::DetectorConstruction() : G4VUserDetectorConstruction(),
  fTubeLength(8.0 * m), fIsWater(true), fHasDiffuser(false) {}

DetectorConstruction::~DetectorConstruction() {}

G4VPhysicalVolume* DetectorConstruction::Construct() {
    G4NistManager* nist = G4NistManager::Instance();

    // -------------------------------------------------------------------------
    // 1. Определение материалов и оптических свойств (405 нм = 3.061 эВ)
    // -------------------------------------------------------------------------
    std::vector<G4double> photonEnergy = { 3.061 * eV }; // 405 нм

    // А) Воздух
    G4Material* air = nist->FindOrBuildMaterial("G4_AIR");
    G4MaterialPropertiesTable* mptAir = new G4MaterialPropertiesTable();
    std::vector<G4double> rindexAir = { 1.00028 };
    std::vector<G4double> absAir    = { 1000.0 * m };
    mptAir->AddProperty("RINDEX", photonEnergy, rindexAir);
    mptAir->AddProperty("ABSLENGTH", photonEnergy, absAir);
    air->SetMaterialPropertiesTable(mptAir);

    // Б) PMMA (Оргстекло входного и выходного окон)
    G4Material* pmma = nist->FindOrBuildMaterial("G4_PLEXIGLASS");
    G4MaterialPropertiesTable* mptPMMA = new G4MaterialPropertiesTable();
    std::vector<G4double> rindexPMMA = { 1.492 };
    std::vector<G4double> absPMMA    = { 15.0 * m };
    mptPMMA->AddProperty("RINDEX", photonEnergy, rindexPMMA);
    mptPMMA->AddProperty("ABSLENGTH", photonEnergy, absPMMA);
    pmma->SetMaterialPropertiesTable(mptPMMA);

    // В) Ультрачистая вода для детектора TAIGA (Lambda_att ≈ 137 м)
    G4Material* water = nist->FindOrBuildMaterial("G4_WATER");
    G4MaterialPropertiesTable* mptWater = new G4MaterialPropertiesTable();
    std::vector<G4double> rindexWater = { 1.333 };
    std::vector<G4double> absWater    = { 188.0 * m }; // Поглощение
    std::vector<G4double> scatWater   = { 500.0 * m }; // Релеевское рассеяние
    mptWater->AddProperty("RINDEX", photonEnergy, rindexWater);
    mptWater->AddProperty("ABSLENGTH", photonEnergy, absWater);
    mptWater->AddProperty("RAYLEIGH", photonEnergy, scatWater);
    water->SetMaterialPropertiesTable(mptWater);

    // -------------------------------------------------------------------------
    // 2. Геометрия установки
    // -------------------------------------------------------------------------
    G4double tubeRadius = 25.0 * mm;      // Труба диаметром 50 мм
    G4double windowThick = 5.0 * mm;      // Окна PMMA 5 мм
    G4Material* medium = fIsWater ? water : air;

    // Мировой объем (World)
    G4Box* solidWorld = new G4Box("World", 1.0*m, 1.0*m, 10.0*m);
    G4LogicalVolume* logicWorld = new G4LogicalVolume(solidWorld, air, "World");
    G4VPhysicalVolume* physWorld = new G4PVPlacement(0, G4ThreeVector(), logicWorld, "World", 0, false, 0);

    // Входное окно PMMA
    G4Tubs* solidWin1 = new G4Tubs("Window1", 0, tubeRadius, windowThick/2.0, 0, 360*deg);
    G4LogicalVolume* logicWin1 = new G4LogicalVolume(solidWin1, pmma, "Window1");
    new G4PVPlacement(0, G4ThreeVector(0, 0, windowThick/2.0), logicWin1, "Window1", logicWorld, false, 0);

    // Объем исследуемой среды (Труба с водой или воздухом)
    G4Tubs* solidTube = new G4Tubs("TubeMedium", 0, tubeRadius, fTubeLength/2.0, 0, 360*deg);
    G4LogicalVolume* logicTube = new G4LogicalVolume(solidTube, medium, "TubeMedium");
    G4VPhysicalVolume* physTube = new G4PVPlacement(0, G4ThreeVector(0, 0, windowThick + fTubeLength/2.0), 
                                                    logicTube, "TubeMedium", logicWorld, false, 0);

    // Оптическая поверхность стенки трубы (поглощение 20%, зеркальное отражение 80%)
    G4OpticalSurface* wallSurface = new G4OpticalSurface("WallSurface");
    wallSurface->SetType(dielectric_metal);
    wallSurface->SetModel(unified);
    wallSurface->SetFinish(polished);
    G4MaterialPropertiesTable* mptWall = new G4MaterialPropertiesTable();
    std::vector<G4double> wallRefl = { 0.80 };
    mptWall->AddProperty("REFLECTIVITY", photonEnergy, wallRefl);
    wallSurface->SetMaterialPropertiesTable(mptWall);
    new G4LogicalSkinSurface("TubeWallSkin", logicTube, wallSurface);

    // Выходное окно PMMA
    G4Tubs* solidWin2 = new G4Tubs("Window2", 0, tubeRadius, windowThick/2.0, 0, 360*deg);
    G4LogicalVolume* logicWin2 = new G4LogicalVolume(solidWin2, pmma, "Window2");
    new G4PVPlacement(0, G4ThreeVector(0, 0, windowThick + fTubeLength + windowThick/2.0), 
                      logicWin2, "Window2", logicWorld, false, 0);

    // Детектор (CMOS сенсор 24x16 мм)
    G4Box* solidDetector = new G4Box("Detector", 12.0*mm, 8.0*mm, 0.5*mm);
    G4LogicalVolume* logicDetector = new G4LogicalVolume(solidDetector, air, "Detector");
    new G4PVPlacement(0, G4ThreeVector(0, 0, windowThick + fTubeLength + windowThick + 2.0*mm), 
                      logicDetector, "Detector", logicWorld, false, 0);

    return physWorld;
}
`;

  const codePrimaryGenerator = `// =============================================================================
// GEANT4 SIMULATION FOR TAIGA EXPERIMENT
// PrimaryGeneratorAction.cc — Laser beam (405 nm, D=20 mm, collimated)
// =============================================================================

#include "PrimaryGeneratorAction.hh"
#include "G4ParticleGun.hh"
#include "G4ParticleTable.hh"
#include "G4OpticalPhoton.hh"
#include "G4SystemOfUnits.hh"
#include "Randomize.hh"

PrimaryGeneratorAction::PrimaryGeneratorAction() : G4VUserPrimaryGeneratorAction() {
    fParticleGun = new G4ParticleGun(1);
    fParticleGun->SetParticleDefinition(G4OpticalPhoton::OpticalPhotonDefinition());
    
    // Энергия кванта лазера 405 нм: E = h*c / lambda = 3.061 эВ
    fParticleGun->SetParticleEnergy(3.061 * eV);
    // Поляризация
    fParticleGun->SetParticlePolarization(G4ThreeVector(1, 0, 0));
}

PrimaryGeneratorAction::~PrimaryGeneratorAction() {
    delete fParticleGun;
}

void PrimaryGeneratorAction::GeneratePrimaries(G4Event* anEvent) {
    // Центральный пучок лазера диаметром 20 мм (гауссов радиус sigma = 5 мм)
    G4double sigma = 5.0 * mm;
    G4double x0 = G4RandGauss::shoot(0.0, sigma);
    G4double y0 = G4RandGauss::shoot(0.0, sigma);
    G4double z0 = -1.0 * mm; // Перед входным окном

    fParticleGun->SetParticlePosition(G4ThreeVector(x0, y0, z0));

    // Параллельный коллимированный пучок после фокусирующей линзы (направление вдоль оси Z)
    G4double div_rad = 0.00008; // 0.08 мрад расходимость
    G4double theta = std::abs(G4RandGauss::shoot(0.0, div_rad));
    G4double phi = G4UniformRand() * 2.0 * CLHEP::pi;

    G4ThreeVector dir(sin(theta)*cos(phi), sin(theta)*sin(phi), cos(theta));
    fParticleGun->SetParticleMomentumDirection(dir);

    fParticleGun->GeneratePrimaryVertex(anEvent);
}
`;

  const codePhysicsList = `// =============================================================================
// GEANT4 SIMULATION FOR TAIGA EXPERIMENT
// PhysicsList.cc — Optical physics processes
// =============================================================================

#include "PhysicsList.hh"
#include "G4OpticalPhysics.hh"
#include "G4OpticalProcessIndex.hh"

PhysicsList::PhysicsList() : G4VModularPhysicsList() {
    // Подключение специализированного оптического физического конструктора
    G4OpticalPhysics* opticalPhysics = new G4OpticalPhysics();

    // Включение процессов: поглощение, Релей, френелевские границы, обратное рассеяние
    opticalPhysics->Configure(kAbsorption, true);
    opticalPhysics->Configure(kRayleigh, true);
    opticalPhysics->Configure(kBoundary, true);

    RegisterPhysics(opticalPhysics);
}

PhysicsList::~PhysicsList() {}
`;

  const codeRunMac = `# =============================================================================
# GEANT4 MACRO: run_taiga.mac
# Серия моделирований прохождения светового пучка через трубу с воздухом и водой
# =============================================================================

/run/initialize

# 1. Запуск в пустой трубе (Воздух) для L = 8 м
/control/verbose 0
/run/verbose 1
/event/verbose 0
/tracking/verbose 0

# Моделирование 1 000 000 фотонов
/run/beamOn 1000000

# Результирующие файлы сохраняются в TTree (ROOT формат):
# - Координаты попадания на детектор (x, y, amp)
# - Количество фотонов, испытавших обратное рассеяние (Backscattering)
# - Энергетический баланс
`;

  const codeCMake = `cmake_minimum_required(VERSION 3.16)
project(TAIGA_Water_Bench)

find_package(Geant4 REQUIRED ui_all vis_all)
include(\${Geant4_USE_FILE})

file(GLOB SOURCES src/*.cc)
file(GLOB HEADERS include/*.hh)

add_executable(taiga_water taiga_water.cc \${SOURCES} \${HEADERS})
target_link_libraries(taiga_water \${Geant4_LIBRARIES})
`;

  const getActiveCode = () => {
    switch (activeFile) {
      case 'DetectorConstruction': return codeDetectorConstruction;
      case 'PrimaryGenerator': return codePrimaryGenerator;
      case 'PhysicsList': return codePhysicsList;
      case 'run_mac': return codeRunMac;
      case 'CMakeLists': return codeCMake;
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getActiveCode());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Atom className="w-5 h-5 text-indigo-600" />
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
              Архитектура моделирования в Geant4 (C++)
            </h3>
            <p className="text-xs text-slate-500">
              Геометрия стенда TAIGA: окна PMMA, труба 50 мм, ультрачистая вода, фокусировка 20 мм, Релеевское и обратное рассеяние.
            </p>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium flex items-center gap-1.5 transition-all text-slate-700 dark:text-slate-300"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? 'Скопировано!' : 'Копировать'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
        <button
          onClick={() => setActiveFile('DetectorConstruction')}
          className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
            activeFile === 'DetectorConstruction' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          DetectorConstruction.cc
        </button>
        <button
          onClick={() => setActiveFile('PrimaryGenerator')}
          className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
            activeFile === 'PrimaryGenerator' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          PrimaryGeneratorAction.cc
        </button>
        <button
          onClick={() => setActiveFile('PhysicsList')}
          className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
            activeFile === 'PhysicsList' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          PhysicsList.cc
        </button>
        <button
          onClick={() => setActiveFile('run_mac')}
          className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
            activeFile === 'run_mac' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          run_taiga.mac
        </button>
        <button
          onClick={() => setActiveFile('CMakeLists')}
          className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
            activeFile === 'CMakeLists' ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          CMakeLists.txt
        </button>
      </div>

      {/* Code */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-950 text-slate-200 font-mono text-xs shadow-inner">
        <pre className="p-4 overflow-x-auto max-h-[550px] leading-relaxed">
          <code>{getActiveCode()}</code>
        </pre>
      </div>

      {/* Geant4 Compilation Instructions */}
      <div className="bg-indigo-50 dark:bg-indigo-950/40 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900 text-xs text-slate-700 dark:text-slate-300 space-y-2">
        <span className="font-bold text-indigo-900 dark:text-indigo-300 block text-sm flex items-center gap-1.5">
          <Terminal className="w-4 h-4 text-indigo-600" />
          Сборка и запуск Geant4 модели:
        </span>
        <div className="bg-slate-900 text-slate-100 p-2.5 rounded font-mono text-[11px] space-y-1">
          <div>$ mkdir build && cd build</div>
          <div>$ cmake -DGeant4_DIR=/path/to/Geant4-install/lib/Geant4-11.x ..</div>
          <div>$ make -j$(nproc)</div>
          <div>$ ./taiga_water run_taiga.mac</div>
        </div>
      </div>
    </div>
  );
};
