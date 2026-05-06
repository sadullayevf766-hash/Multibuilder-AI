// Credit sarfi — har action uchun
export const CREDIT_COSTS = {
  // Super Generator
  super_generate:    5,   // 1 modul generatsiya
  super_edit:        2,   // 1 prompt (edit)
  super_export_pdf:  2,   // PDF yuklab olish
  super_export_dxf:  3,   // DXF yuklab olish (Pro+)

  // Mega Builder
  mega_build:       15,   // barcha tanlangan modullar
  mega_edit:         3,   // 1 ta modul edit prompt
  mega_export_pdf:   3,   // Mega PDF
  mega_export_dxf:   5,   // Mega DXF (Pro+)

  // Simple Generator (floor plan)
  simple_generate:   2,   // oddiy floor plan
  simple_edit:       1,   // edit
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

// Plan limitleri (server-side tekshirish uchun)
export const PLAN_LIMITS = {
  free: {
    max_projects:     2,
    max_mega_modules: 3,
    has_dxf_export:   false,
    has_watermark:    true,
    weekly_credits:   30,
  },
  pro: {
    max_projects:     -1,  // cheksiz
    max_mega_modules: 11,
    has_dxf_export:   true,
    has_watermark:    false,
    monthly_credits:  500,
  },
  business: {
    max_projects:     -1,
    max_mega_modules: 11,
    has_dxf_export:   true,
    has_watermark:    false,
    monthly_credits:  2000,
  },
} as const;
