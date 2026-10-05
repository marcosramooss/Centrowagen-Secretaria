// Hand-written mirrors of the backend Pydantic models — keep both sides in sync in the same edit.

export interface Dimensions {
  length_mm: number | null;
  width_mm: number | null;
  height_mm: number | null;
  wheelbase_mm: number | null;
}

export interface Vehicle {
  id: string;
  brand: string;
  model: string;
  generation: string | null;
  body_type: string;
  trim: string;
  engine: string | null;
  fuel: string;
  hybrid_type: string | null;
  power_cv: number | null;
  transmission: string | null;
  drivetrain: string | null;
  consumption: number | null;
  co2_g: number | null;
  electric_range_km: number | null;
  trunk_l: number | null;
  seats: number | null;
  dimensions: Dimensions | null;
  technical_data: Record<string, string | number>;
  equipment: string[];
  image: string | null;
  active: boolean;
  source: string;
  source_url: string | null;
  last_updated: string;
}

export interface StockUnit {
  id: string;
  vehicle_id: string;
  stock_number: string;
  vin: string | null;
  model: string;
  trim: string;
  engine: string | null;
  power: number | null;
  transmission: string | null;
  exterior_color: string;
  interior_color: string | null;
  options: string[];
  pvp: number | null;
  promotional_price: number | null;
  financing_price: number | null;
  availability: string;
  location: string;
  delivery_estimate: string | null;
  last_updated: string;
}

export interface PriceEntry {
  id: string;
  vehicle_id: string;
  base_price: number;
  promotional_price: number | null;
  financing_price: number | null;
  discount: number | null;
  campaign: string | null;
  valid_from: string | null;
  valid_until: string | null;
  source: string;
  last_updated: string;
}

export interface FinancingOffer {
  id: string;
  vehicle_id: string | null;
  campaign: string;
  entry_payment: number;
  financed_amount: number;
  monthly_payment: number;
  number_of_payments: number;
  final_payment: number | null;
  tin: number;
  tae: number;
  opening_fee: number | null;
  total_amount: number | null;
  conditions: string;
  valid_from: string | null;
  valid_until: string | null;
  source: string;
  last_updated: string;
}

export type PromoStatus = "activa" | "proxima" | "programada" | "finalizada";

export interface Promotion {
  id: string;
  name: string;
  model: string;
  description: string;
  discount: string | null;
  conditions: string;
  financing_required: boolean;
  valid_from: string | null;
  valid_until: string | null;
  source: string;
  last_updated: string;
  status: PromoStatus;
}

export interface DocumentItem {
  id: string;
  name: string;
  category: string;
  file_url: string | null;
  document_type: string;
  upload_date: string;
  version: string;
  source: string;
  active: boolean;
  content_text: string;
  size_bytes: number | null;
}

export interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  source: string;
  last_updated: string;
}

export interface MemoryItem {
  id: string;
  category: string;
  content: string;
  importance: string;
  created_at: string;
  updated_at: string;
}

export interface Objection {
  objection: string;
  response: string;
}

export interface Argumentario {
  id: string;
  model: string;
  strong_points: string[];
  ideal_customer: string;
  sales_arguments: string[];
  objections: Objection[];
  differences: string[];
  discovery_questions: string[];
  source: string;
  last_updated: string;
}

export interface VehicleDetail {
  vehicle: Vehicle;
  price: PriceEntry | null;
  financing: FinancingOffer[];
  promotions: Promotion[];
  stock: StockUnit[];
  argumentario: Argumentario | null;
  related_faq: FaqItem[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "vendedor";
}

export interface SourceRef {
  name: string;
  updated: string;
  estado: string;
}

export interface ChatMeta {
  id: string;
  title: string;
  created_at: string;
  updated_at: string | null;
}

export interface ChatMsg {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  sources: SourceRef[];
  created_at: string;
}

export interface Sale {
  id: string;
  seller_id: string;
  seller_name: string;
  sale_date: string;
  client_name: string;
  vehicle_model: string;
  stock_number: string | null;
  pvp: number;
  discount: number;
  commission_rate: number;
  commission_estimated: number;
  status: string;
  notes: string;
  created_at: string;
}

export interface SalesSettings {
  commission_rate: number;
  monthly_target: number;
}

export interface SalesSummary {
  month_sales: number;
  month_pvp: number;
  month_commission: number;
  year_sales: number;
  year_commission: number;
  commission_rate: number;
  monthly_target: number;
}

export type AuditEstado = "confirmado" | "verificar" | "incorrecto";

export interface AuditResult {
  estado: AuditEstado;
  mensaje: string;
  coincidencias: Record<string, unknown>[];
  fuentes: SourceRef[];
}

export interface Stats {
  vehicles: number;
  stock_units: number;
  stock_immediate: number;
  active_promotions: number;
  prices: number;
  financing_offers: number;
  documents: number;
  faq_items: number;
  memory_items: number;
  sales: number;
  users: number;
  last_sync: Record<string, string>;
  demo: boolean;
}
