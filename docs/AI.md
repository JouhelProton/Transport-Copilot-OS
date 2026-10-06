# IA

La IA debe ayudar a extraer pedidos, analizar documentos e incidencias y redactar comunicaciones. No es la fuente de verdad ni debe ejecutar silenciosamente acciones críticas.

```ts
interface AIProvider {
  extractOrder(data: unknown): Promise<OrderExtraction>;
  analyzeDocument(data: unknown): Promise<DocumentAnalysis>;
  analyzeIncident(data: unknown): Promise<IncidentAnalysis>;
  generateMessage(data: unknown): Promise<string>;
}
```

Empezar con un `MockAIProvider`. El flujo objetivo es entrada → extracción → validación de campos → revisión humana → creación de pedido. La automatización puede actuar sola en pasos reversibles y de bajo riesgo, con política y auditoría explícitas. El usuario confirma precios, asignaciones sensibles, clasificación final de incidencias y cambios de facturación.
