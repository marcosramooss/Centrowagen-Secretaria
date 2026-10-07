// Mirrors models/catalog.py, dataimport.py and auth.py.
export interface OfficialModel {
  id: string; name: string; category: "turismos" | "comerciales";
  image: string | null; source_url: string; detail_url: string;
  body_types: string[]; fuels: string[]; transmissions: string[]; trims: string[];
  power_cv: number[]; status: string;
}
export interface OfficialCatalog {
  checked_at: string | null; models: OfficialModel[]; sources: string[]; warnings: string[]; stale: boolean;
  sync_status: string; last_attempt_at: string | null; sync_error: string | null;
  automatic_schedule: string; next_sync_at: string | null; added_model_ids: string[];
}
export interface PreviewRow {
  row: number; label: string; action: "crear" | "actualizar" | "rechazada"; message: string;
  values: Record<string, unknown>; changes: Record<string, { antes: unknown; después: unknown }>;
}
export interface ImportPreview {
  id: string; kind: "vehicles" | "stock"; filename: string; detected_columns: Record<string, string>;
  rows: PreviewRow[]; valid_rows: number; rejected_rows: number;
}
export interface ConfirmImport { preview_id: string; confirm: true }
export interface ImportResult {
  filename: string; detected_columns: Record<string, string>; created: number; updated: number; skipped: number;
  rows: { row: number; label: string; action: string; message: string }[];
}
export interface SetupStatus { required: boolean }
// SetupIn.password: 5–128 characters, matching backend/models/auth.py and Login.tsx.
export interface SetupIn { name: string; email: string; password: string; setup_token: string }