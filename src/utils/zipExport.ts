import JSZip from 'jszip';

export async function downloadWaterPurityZip() {
  const zip = new JSZip();

  // Fetch or load the file contents
  // We can fetch them directly from the app server since they are served at root
  const filesToInclude = [
    { name: 'README.md', path: '/README.md' },
    { name: 'PHYSICS_DESCRIPTION.md', path: '/PHYSICS_DESCRIPTION.md' },
    { name: 'water_sim_v2.C', path: '/water_sim_v2.C' },
    { name: 'analyze_data_v2.C', path: '/analyze_data_v2.C' },
    { name: 'run_pipeline.sh', path: '/run_pipeline.sh' },
  ];

  for (const file of filesToInclude) {
    try {
      const response = await fetch(file.path);
      if (response.ok) {
        const content = await response.text();
        zip.file(file.name, content);
      }
    } catch (e) {
      console.warn(`Could not fetch ${file.name}, using fallback`);
    }
  }

  // Geant4 folder
  const geant4Folder = zip.folder('geant4');
  if (geant4Folder) {
    geant4Folder.file('run_taiga.mac', `# Geant4 macro for TAIGA
/run/initialize
/run/verbose 1
/run/beamOn 1000000
`);
    geant4Folder.file('CMakeLists.txt', `cmake_minimum_required(VERSION 3.16)
project(TAIGA_Water_Bench)
find_package(Geant4 REQUIRED ui_all vis_all)
include(\${Geant4_USE_FILE})
file(GLOB SOURCES src/*.cc)
file(GLOB HEADERS include/*.hh)
add_executable(taiga_water taiga_water.cc \${SOURCES} \${HEADERS})
target_link_libraries(taiga_water \${Geant4_LIBRARIES})
`);
  }

  // Generate ZIP blob and trigger download
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'water_purity_repo_update.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
