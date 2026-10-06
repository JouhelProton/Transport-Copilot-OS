import { demoOrder } from '../data.js';

// Mock de extracción aislado de la interfaz. Sustituible por OCR/API en una fase posterior.
export async function simulateOrderExtraction(onProgress) {
  const stages = [
    { label: 'Leyendo documento', progress: 18 },
    { label: 'Extrayendo información', progress: 42 },
    { label: 'Validando datos', progress: 68 },
    { label: 'Buscando inconsistencias', progress: 88 },
    { label: 'Pedido procesado', progress: 100 }
  ];
  for (const stage of stages) {
    onProgress(stage);
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return { ...demoOrder };
}
