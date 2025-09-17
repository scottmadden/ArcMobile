// lib/types.ts
export type UUID = string;

export interface Org { id: UUID; name: string; created_at: string; }
export interface Profile { id: UUID; email?: string; full_name?: string; created_at?: string; }
export interface Truck { id: UUID; org_id: UUID; name: string; license_plate?: string; created_at?: string; }
export interface Template { id: UUID; org_id: UUID; title: string; description?: string; frequency?: string; created_at?: string; }
export interface TemplateItem { id: UUID; template_id: UUID; label: string; type: string; required: boolean; sort_order: number; }
export interface Checklist { id: UUID; org_id: UUID; truck_id?: UUID; template_id: UUID; run_by?: UUID; started_at?: string; submitted_at?: string | null; notes?: string; }
export interface ResponseRow { id: UUID; checklist_id: UUID; template_item_id: UUID; value?: string; created_at?: string; }
export interface DocumentRow { id: UUID; org_id: UUID; truck_id?: UUID; storage_path: string; filename?: string; uploaded_by?: UUID; created_at?: string; }
