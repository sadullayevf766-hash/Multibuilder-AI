/**
 * BoilerRoomEngine — Qozonxona tizimi generatsiyasi
 *
 * PDF (Xumson ОВиК) 18-22-sahifalar asosida:
 * - Issiqlik nasosi: EMHP-16Y/N8 EEC (tashqi blok)
 * - Gidrobox: EHB-160/N8 EEC (ichki blok, x3)
 * - Bufer sig'im: ET 1000 (teploak'kumulyator)
 * - Kosvennyy boiler: AI 500/1M_B
 * - Sovuq suv nasosi: CMBE 5-62
 * - GVS tsirkulyatsiya nasosi: UPS 25-65
 * - ALPHA2 nasoslar (qavat bo'ylab isitish)
 * - Filtrlar: BWT R1RSF DN25, MULTI 2000 C, BWT AQA perla-20
 * - Kengayish baki: 30L (isitish), 50L (HVS)
 * - Neptun Profi 12V elektr klapan (DN32)
 * - DN32 sovuq suv hisoblagich
 */

// ── Tiplar ────────────────────────────────────────────────────────────────────

export type BoilerEquipmentType =
  | 'heat_pump_outdoor'
  | 'heat_pump_indoor'
  | 'buffer_tank'
  | 'boiler_indirect'
  | 'pump_cold'
  | 'pump_circulation_hvs'
  | 'pump_circulation_floor'
  | 'filter_mechanical'
  | 'filter_softener'
  | 'filter_clean'
  | 'expansion_tank_heating'
  | 'expansion_tank_hvs'
  | 'water_meter'
  | 'electric_valve'
  | 'mixing_valve_3way'
  | 'manifold_supply'
  | 'manifold_return';

export interface BoilerEquipment {
  id:       string;
  type:     BoilerEquipmentType;
  nameRu:   string;
  nameUz:   string;
  model:    string;
  qty:      number;
  pipeDiam: number;    // mm (DN)
  x:        number;   // relative 0..1
  y:        number;
  width:    number;   // m
  depth:    number;   // m
  height:   number;   // m
  note:     string;
}

export interface BoilerPipe {
  id:      string;
  type:    'supply' | 'return' | 'cold' | 'hot' | 'circ' | 'drain';
  from:    string;   // equipment id
  to:      string;
  diamMm:  number;
  color:   string;
}

export interface BoilerCircuit {
  id:      string;
  nameUz:  string;
  type:    'heating' | 'hvs' | 'cold' | 'warm_floor' | 'warm_wall';
  floor:   number;
  pumpId?: string;
  supplyT: number;   // °C
  returnT: number;
}

export interface BoilerRoomSchema {
  id:            string;
  name:          string;
  equipment:     BoilerEquipment[];
  pipes:         BoilerPipe[];
  circuits:      BoilerCircuit[];
  roomWidthM:    number;
  roomDepthM:    number;
  totalHeatKw:   number;
  heatPumpCount: number;
  floors:        number;
  specItems:     BoilerSpecItem[];
  notes:         string[];
}

export interface BoilerSpecItem {
  pos:    number;
  nameUz: string;
  model:  string;
  qty:    number;
  unit:   string;
}

// ── Input ─────────────────────────────────────────────────────────────────────

export interface BoilerRoomInput {
  floors:       number;
  totalAreaM2:  number;
  hasWarmFloor: boolean;
  hasWarmWall:  boolean;
  hasHvs:       boolean;   // issiq suv ta'minoti
}

// ── Engine ─────────────────────────────────────────────────────────────────────

export class BoilerRoomEngine {

  generate(input: BoilerRoomInput): BoilerRoomSchema {
    const id = `br-${Date.now()}`;
    const { floors, totalAreaM2, hasWarmFloor, hasWarmWall, hasHvs } = input;

    // Issiqlik hisob-kitobi (taxminiy)
    const heatLoadW = totalAreaM2 * 80;   // 80 W/m² (o'rtacha)
    const totalHeatKw = Math.round(heatLoadW / 1000 * 10) / 10;

    // Issiqlik nasosi soni (har biri ~16 kW)
    const heatPumpCount = Math.max(1, Math.ceil(totalHeatKw / 16));

    const equipment: BoilerEquipment[] = [];
    const pipes: BoilerPipe[] = [];
    const circuits: BoilerCircuit[] = [];
    let eIdx = 1;

    // ─────────────────────────────────────────────────────────────────────────
    // Joylashuv: PDF 25-sahifa "3D ВИД КОТЕЛЬНОГО ОБОРУДОВАНИЯ" ga mos
    // x: 0=chap, 1=o'ng  |  y: 0=old (kirish), 1=orqa (devor)
    // ─────────────────────────────────────────────────────────────────────────

    // ── Chap-orqa devor: EHB gidroboxlar (PDF 25: chap devorda qatorlab) ──────
    for (let i = 0; i < heatPumpCount; i++) {
      equipment.push({
        id: `eq-hp-in-${i + 1}`,
        type: 'heat_pump_indoor',
        nameRu: 'Внутренний блок теплового насоса гидробокс',
        nameUz: `Ichki gidrobox #${i + 1}`,
        model: 'EHB-160/N8 EEC',
        qty: 1,
        pipeDiam: 25,
        x: 0.03 + i * 0.13,   // chap devor bo'ylab chapdan o'ngga
        y: 0.03,               // orqa devorga yaqin
        width: 0.55, depth: 0.55, height: 1.6,
        note: `Gidrobox #${i + 1}`,
      });
    }

    // ── Tashqi blok — xona tashqarisida (devor ortida, chizmada yuqorida) ─────
    equipment.push({
      id: 'eq-hp-out',
      type: 'heat_pump_outdoor',
      nameRu: 'Наружный блок теплового насоса',
      nameUz: 'Tashqi issiqlik nasosi bloki',
      model: `EMHP-${heatPumpCount <= 1 ? '16' : heatPumpCount <= 2 ? '32' : '48'}Y/N8 EEC`,
      qty: 1,
      pipeDiam: 25,
      x: 0.03,
      y: -0.05,   // devordan tashqarida (salbiy y — devor ortida)
      width: Math.min(heatPumpCount * 0.55, 1.8), depth: 0.65, height: 1.4,
      note: `${heatPumpCount * 16} kW — tashqi`,
    });

    // ── Markaz: ET 1000 teploak'kumulyator ────────────────────────────────────
    equipment.push({
      id: 'eq-buffer',
      type: 'buffer_tank',
      nameRu: 'Теплоаккумулятор',
      nameUz: 'Issiqlik akkumulyatori (ET 1000)',
      model: 'ET 1000',
      qty: 1,
      pipeDiam: 32,
      x: 0.38, y: 0.28,   // xona markazi, biroz orqada
      width: 0.85, depth: 0.85, height: 2.1,
      note: '1000 L',
    });

    // ── Markaz-chap: Reflex 30L isitish kengayish baki ────────────────────────
    equipment.push({
      id: 'eq-exp-heat',
      type: 'expansion_tank_heating',
      nameRu: 'Расширительный бак для отопления',
      nameUz: 'Isitish kengayish baki (30L)',
      model: 'Reflex 30L',
      qty: 1,
      pipeDiam: 20,
      x: 0.28, y: 0.50,   // buffer oldida, chap tomonda
      width: 0.38, depth: 0.38, height: 0.55,
      note: '30 litr, qizil',
    });

    // ── O'ng: AI 500/1M_B bilvosita isitgich (boiler) ─────────────────────────
    if (hasHvs) {
      equipment.push({
        id: 'eq-boiler',
        type: 'boiler_indirect',
        nameRu: 'Косвенный бойлер',
        nameUz: 'Bilvosita isitgich (AI 500)',
        model: 'AI 500/1M_B',
        qty: 1,
        pipeDiam: 32,
        x: 0.62, y: 0.22,   // o'ng tomon, orqaroq
        width: 0.70, depth: 0.70, height: 2.0,
        note: '500 L issiq suv',
      });

      // Reflex 50L — boiler tepasida, o'ngda
      equipment.push({
        id: 'eq-exp-hvs',
        type: 'expansion_tank_hvs',
        nameRu: 'Расширительный бак для ГВС',
        nameUz: 'GVS kengayish baki (50L)',
        model: 'Reflex 50L',
        qty: 1,
        pipeDiam: 20,
        x: 0.72, y: 0.10,   // boiler orqasida-tepasida
        width: 0.42, depth: 0.42, height: 0.65,
        note: '50 litr, ko\'k',
      });

      // UPS 25-65 — boiler oldida
      equipment.push({
        id: 'eq-pump-hvs',
        type: 'pump_circulation_hvs',
        nameRu: 'Циркуляционный насос ГВС',
        nameUz: 'GVS tsirkul nasosi (UPS 25-65)',
        model: 'UPS 25-65',
        qty: 1,
        pipeDiam: 25,
        x: 0.62, y: 0.50,   // boiler oldida
        width: 0.28, depth: 0.14, height: 0.24,
        note: 'Issiq suv aylanma',
      });
    }

    // ── O'ng-old: Nasos uzeli — ALPHA2 + FHC/PHC kollektorlar ────────────────
    // PDF 25: o'ng-old burchakda vertikal qator
    equipment.push({
      id: 'eq-manifold-sup',
      type: 'manifold_supply',
      nameRu: 'Коллектор подачи (FHC)',
      nameUz: 'Berilish kollektori (FHC)',
      model: `FHC ${floors}-выход`,
      qty: 1,
      pipeDiam: 32,
      x: 0.62, y: 0.60,
      width: 0.50, depth: 0.10, height: 0.12,
      note: `${floors} ta chiqish`,
    });

    equipment.push({
      id: 'eq-manifold-ret',
      type: 'manifold_return',
      nameRu: 'Коллектор обратки (PHC)',
      nameUz: 'Qaytish kollektori (PHC)',
      model: `PHC ${floors}-выход`,
      qty: 1,
      pipeDiam: 32,
      x: 0.62, y: 0.68,
      width: 0.50, depth: 0.10, height: 0.12,
      note: `${floors} ta kirish`,
    });

    // ALPHA2 nasoslar — kollektordan o'ngga, vertikal qator (PDF 25: o'ng devorga yaqin)
    for (let f = 1; f <= floors; f++) {
      const fx = 0.75 + (f - 1) * 0.00;  // bir ustunda
      const fy = 0.58 + (f - 1) * 0.13;  // vertikal tushib boradi
      equipment.push({
        id: `eq-alpha-${f}`,
        type: 'pump_circulation_floor',
        nameRu: `Циркуляционный насос ${f}-этаж`,
        nameUz: `${f}-qavat tsirkul nasosi`,
        model: 'ALPHA2 25-40 N80',
        qty: 1,
        pipeDiam: 25,
        x: fx, y: fy,
        width: 0.26, depth: 0.13, height: 0.22,
        note: `${f}-qavat`,
      });

      equipment.push({
        id: `eq-3way-${f}`,
        type: 'mixing_valve_3way',
        nameRu: `3-ходовой клапан ${f}-этаж`,
        nameUz: `${f}-qavat aralash klapan`,
        model: 'Esbe VRG131 DN25',
        qty: 1,
        pipeDiam: 25,
        x: fx - 0.08, y: fy + 0.04,
        width: 0.09, depth: 0.09, height: 0.14,
        note: `${f}-qavat`,
      });
    }

    // ── Chap-old: Filtrlar qatori (PDF 25: chap past burchak) ─────────────────
    equipment.push({
      id: 'eq-flt-mech',
      type: 'filter_mechanical',
      nameRu: 'Фильтр механической очистки',
      nameUz: 'Mexanik filtr (BWT R1RSF)',
      model: 'BWT R1RSF DN25',
      qty: 1,
      pipeDiam: 25,
      x: 0.04, y: 0.68,   // chap-old
      width: 0.14, depth: 0.14, height: 0.42,
      note: 'DN25, 5μm',
    });

    equipment.push({
      id: 'eq-flt-clean',
      type: 'filter_clean',
      nameRu: 'Фильтр для очистки воды',
      nameUz: 'Tozalash filtri (MULTI 2000)',
      model: 'MULTI 2000 C',
      qty: 1,
      pipeDiam: 25,
      x: 0.12, y: 0.68,   // mexanik filtr o'ngida
      width: 0.22, depth: 0.22, height: 0.65,
      note: 'Ko\'p bosqichli',
    });

    equipment.push({
      id: 'eq-flt-soft',
      type: 'filter_softener',
      nameRu: 'Фильтр умягчения воды',
      nameUz: 'Yumshatish filtri (AQA perla)',
      model: 'BWT AQA perla-20',
      qty: 1,
      pipeDiam: 25,
      x: 0.22, y: 0.68,   // MULTI o'ngida
      width: 0.26, depth: 0.26, height: 0.85,
      note: 'Ion almashtirish',
    });

    // CMBE 5-62 — filtrlar oldida (PDF 25: filtr qatoridan oldingi nasos)
    equipment.push({
      id: 'eq-pump-cold',
      type: 'pump_cold',
      nameRu: 'Насос ХВС',
      nameUz: 'Sovuq suv nasosi (CMBE 5-62)',
      model: 'CMBE 5-62',
      qty: 1,
      pipeDiam: 32,
      x: 0.04, y: 0.82,   // filtrlar oldida, chap
      width: 0.38, depth: 0.22, height: 0.38,
      note: 'Q=5 m³/h, H=62 m',
    });

    // ── O'ng-old kirish: DN32 hisoblagich + Neptun klapan ─────────────────────
    equipment.push({
      id: 'eq-water-meter',
      type: 'water_meter',
      nameRu: 'Счётчик холодной воды DN32',
      nameUz: 'Sovuq suv hisoblagich (DN32)',
      model: 'DN32',
      qty: 1,
      pipeDiam: 32,
      x: 0.84, y: 0.82,   // o'ng-old — kirish nuqtasi
      width: 0.18, depth: 0.10, height: 0.14,
      note: 'Kirish quvuri',
    });

    equipment.push({
      id: 'eq-elec-valve',
      type: 'electric_valve',
      nameRu: 'Кран-шаровой с электроприводом',
      nameUz: 'Elektr klapan (Neptun Profi)',
      model: 'Neptun Profi 12V DN32',
      qty: 1,
      pipeDiam: 32,
      x: 0.84, y: 0.88,
      width: 0.12, depth: 0.10, height: 0.12,
      note: '12V',
    });

    // ── Sxemalar (pipes) ──────────────────────────────────────────────────────
    pipes.push(
      { id: 'p-cold-in',    type: 'cold',   from: 'eq-water-meter',  to: 'eq-elec-valve',   diamMm: 32, color: '#2563eb' },
      { id: 'p-cold-pump',  type: 'cold',   from: 'eq-elec-valve',   to: 'eq-flt-mech',     diamMm: 32, color: '#2563eb' },
      { id: 'p-cold-flt1',  type: 'cold',   from: 'eq-flt-mech',     to: 'eq-flt-clean',    diamMm: 25, color: '#2563eb' },
      { id: 'p-cold-flt2',  type: 'cold',   from: 'eq-flt-clean',    to: 'eq-flt-soft',     diamMm: 25, color: '#2563eb' },
      { id: 'p-cold-flt3',  type: 'cold',   from: 'eq-flt-soft',     to: 'eq-pump-cold',    diamMm: 25, color: '#2563eb' },
      { id: 'p-heat-buf',   type: 'supply', from: 'eq-hp-in-1',      to: 'eq-buffer',       diamMm: 32, color: '#dc2626' },
      { id: 'p-buf-coll',   type: 'supply', from: 'eq-buffer',       to: 'eq-manifold-sup', diamMm: 32, color: '#dc2626' },
      { id: 'p-coll-ret',   type: 'return', from: 'eq-manifold-ret', to: 'eq-buffer',       diamMm: 32, color: '#2563eb' },
    );

    if (hasHvs) {
      pipes.push(
        { id: 'p-cold-boiler', type: 'cold',   from: 'eq-pump-cold', to: 'eq-boiler',    diamMm: 25, color: '#2563eb' },
        { id: 'p-hot-out',     type: 'hot',    from: 'eq-boiler',    to: 'eq-pump-hvs',  diamMm: 25, color: '#f97316' },
        { id: 'p-circ-ret',    type: 'circ',   from: 'eq-pump-hvs',  to: 'eq-boiler',    diamMm: 20, color: '#f59e0b' },
      );
    }

    // ── Tsirkulyatsiya sxemalari ──────────────────────────────────────────────
    for (let f = 1; f <= floors; f++) {
      circuits.push({
        id:      `circ-floor-${f}`,
        nameUz:  `${f}-qavat isitish`,
        type:    hasWarmFloor ? 'warm_floor' : 'heating',
        floor:   f,
        pumpId:  `eq-alpha-${f}`,
        supplyT: 45,
        returnT: 35,
      });
    }

    if (hasHvs) {
      circuits.push({
        id: 'circ-hvs', nameUz: 'Issiq suv (GVS)', type: 'hvs',
        floor: 0, pumpId: 'eq-pump-hvs', supplyT: 55, returnT: 45,
      });
    }

    // ── Spetsifikatsiya ───────────────────────────────────────────────────────
    const specItems: BoilerSpecItem[] = equipment.map((eq, i) => ({
      pos:    i + 1,
      nameUz: eq.nameUz,
      model:  eq.model,
      qty:    eq.qty,
      unit:   'dona',
    }));

    return {
      id,
      name: 'Qozonxona tizimi sxemasi',
      equipment,
      pipes,
      circuits,
      roomWidthM:    8.0,   // PDF 18: xona kengligi ~8m
      roomDepthM:    6.5,   // PDF 18: xona chuqurligi ~6.5m
      totalHeatKw,
      heatPumpCount,
      floors,
      specItems,
      notes: [
        `Issiqlik yuki: ~${totalHeatKw} kW (80 W/m² × ${totalAreaM2} m²)`,
        `Issiqlik nasosi: ${heatPumpCount}x EMHP-16Y/N8 EEC`,
        'Bufer: ET 1000 (1000 L teploak\'kumulyator)',
        'Isitish: 45/35°C (qavat isitish)',
        hasHvs ? 'GVS: AI 500/1M_B boiler + UPS 25-65 sirkulyatsiya' : '',
        'Filtratsiya: mexanik → tozalash → yumshatish',
        'Kirishda: DN32 hisoblagich + Neptun Profi 12V elektr klapan',
        'Kengayish: 30L (isitish), 50L (GVS)',
      ].filter(Boolean),
    };
  }
}
