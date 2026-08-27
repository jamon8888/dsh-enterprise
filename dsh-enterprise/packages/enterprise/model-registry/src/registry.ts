export interface ModelVersion {
  modelId: string;
  trainingDataHash: string;
  metrics: Record<string, number>;
  approvalBy: string;
  createdAt: number;
}
const store = new Map<string, ModelVersion>();
export function registerModel(v: ModelVersion): ModelVersion {
  store.set(v.modelId, v);
  return v;
}
export function getModel(id: string): ModelVersion | undefined {
  return store.get(id);
}
