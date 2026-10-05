// Hand-written mirrors of the backend Pydantic models added in phase 2.

export interface Task {
  id: string;
  owner_id: string;
  owner_name: string;
  title: string;
  kind: string;
  client_name: string;
  client_phone: string;
  client_email: string | null;
  vehicle_model: string;
  due_date: string;
  due_time: string | null;
  priority: string;
  notes: string;
  status: "pendiente" | "hecha";
  created_at: string;
  completed_at: string | null;
}

export interface TaskSummary {
  overdue: number;
  today: number;
  upcoming: number;
  pending: number;
  done: number;
  next_tasks: Task[];
}

export interface TariffRow {
  row: number;
  model: string;
  trim: string;
  base_price: number | null;
  promotional_price: number | null;
  financing_price: number | null;
  discount: number | null;
  campaign: string | null;
  status: "actualizable" | "nueva" | "no_reconocida";
  vehicle_id: string | null;
  current_price: number | null;
  message: string;
}

export interface TariffPreview {
  filename: string;
  detected_columns: Record<string, string>;
  total_rows: number;
  updatable: number;
  new_rows: number;
  unrecognized: number;
  rows: TariffRow[];
}

export interface TariffApplyResult {
  prices_updated: number;
  prices_created: number;
  stock_updated: number;
  skipped: number;
  messages: string[];
}

export interface AiModel {
  key: string;
  provider: string;
  model: string;
  label: string;
  description: string;
  default: boolean;
}
