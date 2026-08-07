// Blood work markers, shared by the client dashboard and the admin panel.
// Insertion order drives the on-screen pill order, so add new markers next to
// the ones they are read alongside rather than at the end.
export const MARKER_DEFAULTS: Record<string, { label: string; unit: string }> = {
  total_t:       { label: "Total T",       unit: "ng/dL" },
  free_t:        { label: "Free T",        unit: "pg/mL" },
  shbg:          { label: "SHBG",          unit: "nmol/L" },
  estradiol:     { label: "Estradiol",     unit: "pg/mL" },
  lh:            { label: "LH",            unit: "mIU/mL" },
  fsh:           { label: "FSH",           unit: "mIU/mL" },
  prolactin:     { label: "Prolactin",     unit: "ng/mL" },
  cortisol:      { label: "Cortisol",      unit: "μg/dL" },
  hematocrit:    { label: "Hematocrit",    unit: "%" },
  hemoglobin:    { label: "Hemoglobin",    unit: "g/dL" },
  rbc:           { label: "RBC",           unit: "M/μL" },
  psa:           { label: "PSA",           unit: "ng/mL" },
  dhea_s:        { label: "DHEA-S",        unit: "μg/dL" },
  igf1:          { label: "IGF-1",         unit: "ng/mL" },
  tsh:           { label: "TSH",           unit: "mIU/L" },
  t3_free:       { label: "Free T3",       unit: "pg/mL" },
  t4_free:       { label: "Free T4",       unit: "ng/dL" },
  vitamin_d:     { label: "Vitamin D",     unit: "ng/mL" },
  ferritin:      { label: "Ferritin",      unit: "ng/mL" },
  cholesterol:   { label: "Cholesterol",   unit: "mg/dL" },
  hdl:           { label: "HDL",           unit: "mg/dL" },
  ldl:           { label: "LDL",           unit: "mg/dL" },
  triglycerides: { label: "Triglycerides", unit: "mg/dL" },
  glucose:       { label: "Glucose",       unit: "mg/dL" },
  hba1c:         { label: "HbA1c",         unit: "%" },
  creatinine:    { label: "Creatinine",    unit: "mg/dL" },
  alt:           { label: "ALT",           unit: "U/L" },
  ast:           { label: "AST",           unit: "U/L" },
};

export interface BloodMarker {
  value: number | null;
  unit: string;
  reference_range?: string | null;
  flag?: "high" | "low" | "normal" | null;
}

export interface BloodWorkEntry {
  id: string;
  uploaded_at: string;
  test_date: string | null;
  markers: Record<string, BloodMarker> | null;
  extraction_notes: string | null;
  image_url: string;
}
