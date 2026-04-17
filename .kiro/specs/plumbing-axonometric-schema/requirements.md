# Requirements Document

## Introduction

Multibuilder-AI loyihasiga yangi chizma turi — "Suv ta'minoti aksonometrik sxemasi" (Plumbing Axonometric Schema) qo'shiladi. Bu chizma turi 1-3 qavatli binolar uchun sovuq suv, issiq suv va kanalizatsiya quvurlarini aksonometrik (izometrik) proyeksiyada ko'rsatadi. Foydalanuvchi yangi loyiha yaratishda chizma turini tanlaydi: "Arxitektura rejasi" yoki "Suv ta'minoti aksonometrik sxemasi". Quvur diametrlari avtomatik hisoblanadi va GOST standartiga mos shtamp bilan chiqariladi.

## Glossary

- **PlumbingEngine**: Aksonometrik sxema uchun koordinata va quvur diametrlarini hisoblaydigan server-side engine
- **AxonometricCanvas**: Aksonometrik sxemani Konva.js yordamida chizadigan client-side komponent
- **Riser** (Stoyak): Barcha qavatlarni vertikal bog'laydigan asosiy quvur
- **Branch** (Tarmoq): Stoyakdan sanitariya asboblariga boradigan gorizontal quvur
- **Fixture** (Sanitariya asbob): Lavabo, hojatxona, vanna, dush, kir yuvish mashinasi
- **ColdPipe**: Sovuq suv quvuri (binafsha/pushti rang, GOST bo'yicha)
- **HotPipe**: Issiq suv quvuri (ko'k rang, GOST bo'yicha)
- **DrainPipe**: Kanalizatsiya/oqova quvuri (kulrang, kesik chiziq)
- **DrawingType**: Chizma turi — `floor-plan` yoki `plumbing-axonometric`
- **PlumbingSchema**: Aksonometrik sxema uchun to'liq ma'lumot strukturasi
- **DiameterCalculator**: Sanitariya asboblar soniga qarab quvur diametrini hisoblaydigan modul
- **TitleBlock**: GOST standartiga mos shtamp (pastki o'ng burchak)
- **FloorCount**: Bino qavatlar soni (1 dan 3 gacha)

---

## Requirements

### Requirement 1: Chizma turini tanlash

**User Story:** As a foydalanuvchi, I want yangi loyiha yaratishda chizma turini tanlashni, so that men arxitektura rejasi yoki suv ta'minoti sxemasini alohida yarata olaman.

#### Acceptance Criteria

1. WHEN foydalanuvchi yangi loyiha yaratish sahifasini ochganda, THE Generator SHALL chizma turini tanlash uchun ikkita variant ko'rsatishi kerak: "Arxitektura rejasi" va "Suv ta'minoti aksonometrik sxemasi".
2. WHEN foydalanuvchi "Suv ta'minoti aksonometrik sxemasi" ni tanlaganda, THE Generator SHALL qavatlar soni (1-3) va xona tavsifi kiritish maydonlarini ko'rsatishi kerak.
3. WHEN foydalanuvchi "Arxitektura rejasi" ni tanlaganda, THE Generator SHALL mavjud xona tavsifi kiritish oqimini o'zgartirmasdan davom ettirishi kerak.
4. THE Generator SHALL tanlangan DrawingType ni API so'roviga qo'shib yuborishi kerak.
5. IF foydalanuvchi qavatlar sonini kiritmasa, THEN THE Generator SHALL standart qiymat sifatida 1 qavatni ishlatishi kerak.

---

### Requirement 2: Aksonometrik sxema ma'lumot strukturasi

**User Story:** As a dasturchi, I want aksonometrik sxema uchun aniq tip strukturasini, so that server va client o'rtasida ma'lumot almashish xavfsiz va izchil bo'lsin.

#### Acceptance Criteria

1. THE shared/types.ts SHALL `DrawingType` tipini (`'floor-plan' | 'plumbing-axonometric'`) eksport qilishi kerak.
2. THE shared/types.ts SHALL `PlumbingFixture` interfeysini eksport qilishi kerak — `id`, `type` (`'sink' | 'toilet' | 'bathtub' | 'shower' | 'washing_machine'`), `floor`, `position` (`x`, `y`) maydonlari bilan.
3. THE shared/types.ts SHALL `PlumbingPipe` interfeysini eksport qilishi kerak — `id`, `type` (`'cold' | 'hot' | 'drain'`), `path` (Point[]), `diameter` (mm), `label` (string) maydonlari bilan.
4. THE shared/types.ts SHALL `PlumbingSchema` interfeysini eksport qilishi kerak — `id`, `floorCount`, `fixtures` (PlumbingFixture[]), `pipes` (PlumbingPipe[]), `risers` (PlumbingPipe[]) maydonlari bilan.
5. THE shared/types.ts SHALL `DrawingData` interfeysini `drawingType?: DrawingType` va `plumbingSchema?: PlumbingSchema` maydonlari bilan kengaytirishi kerak.

---

### Requirement 3: Quvur diametrini avtomatik hisoblash

**User Story:** As a foydalanuvchi, I want quvur diametrlarini avtomatik hisoblanishini, so that men qo'lda hisoblash bilan vaqt sarflamasdan to'g'ri diametrlarni olaman.

#### Acceptance Criteria

1. THE DiameterCalculator SHALL har bir sanitariya asbob uchun sarflov birligini (design flow unit) quyidagicha belgilashi kerak: lavabo = 0.3 l/s, hojatxona = 1.6 l/s, vanna = 0.3 l/s, dush = 0.2 l/s, kir yuvish mashinasi = 0.3 l/s.
2. WHEN stoyak quvuri hisoblanayotganda, THE DiameterCalculator SHALL stoyakka ulangan barcha asboblar sarflov birliklarini yig'ib, jami oqim bo'yicha diametrni belgilashi kerak: jami oqim ≤ 0.8 l/s → Dn 20, ≤ 1.5 l/s → Dn 25, ≤ 3.0 l/s → Dn 32, > 3.0 l/s → Dn 40.
3. WHEN tarmoq quvuri hisoblanayotganda, THE DiameterCalculator SHALL faqat shu tarmoqqa ulangan asboblar sarflov birliklarini hisobga olishi kerak.
4. THE DiameterCalculator SHALL kanalizatsiya quvurlari uchun alohida diametr belgilashi kerak: bitta asbob → Dn 50, ikki va undan ko'p → Dn 100.
5. WHEN hisoblash tugaganda, THE DiameterCalculator SHALL har bir quvur uchun `label` maydonini `"Dn XX"` formatida to'ldirishi kerak.

---

### Requirement 4: Aksonometrik sxema generatsiyasi (PlumbingEngine)

**User Story:** As a foydalanuvchi, I want AI tavsifidan avtomatik aksonometrik sxema yaratilishini, so that men qo'lda chizmasdan professional sxema olaman.

#### Acceptance Criteria

1. THE PlumbingEngine SHALL foydalanuvchi tavsifi va qavatlar sonidan `PlumbingSchema` obyektini yaratishi kerak.
2. WHEN PlumbingEngine sxema yaratayotganda, THE PlumbingEngine SHALL har bir qavatga standart sanitariya asboblar to'plamini joylashtirishi kerak: lavabo, hojatxona, vanna yoki dush.
3. THE PlumbingEngine SHALL har qavat uchun vertikal stoyak koordinatalarini hisoblashi kerak — stoyak x=0 dan boshlanib, har qavat uchun y koordinatasi `floorIndex * FLOOR_HEIGHT` bo'lishi kerak, bu yerda `FLOOR_HEIGHT = 300` birlik (3 metr).
4. THE PlumbingEngine SHALL har bir sanitariya asbobdan stoyakka gorizontal tarmoq quvurini hisoblashi kerak.
5. THE PlumbingEngine SHALL sovuq suv, issiq suv va kanalizatsiya uchun alohida stoyaklar yaratishi kerak.
6. IF foydalanuvchi tavsifida qazan xonasi jihozlari (qozon, nasos) tilga olinsa, THEN THE PlumbingEngine SHALL ularni sxemaga qo'shmasligi kerak.
7. THE PlumbingEngine SHALL barcha quvurlar uchun DiameterCalculator ni chaqirib diametrlarni belgilashi kerak.

---

### Requirement 5: Aksonometrik sxemani chizish (AxonometricCanvas)

**User Story:** As a foydalanuvchi, I want aksonometrik sxemani ekranda ko'rishni, so that men professional ko'rinishdagi chizmani ko'rib tekshira olaman.

#### Acceptance Criteria

1. THE AxonometricCanvas SHALL `PlumbingSchema` ma'lumotlarini Konva.js yordamida chizishi kerak.
2. THE AxonometricCanvas SHALL sovuq suv quvurlarini binafsha/pushti rang (`#c084fc`) va to'liq chiziq bilan ko'rsatishi kerak.
3. THE AxonometricCanvas SHALL issiq suv quvurlarini ko'k rang (`#3b82f6`) va to'liq chiziq bilan ko'rsatishi kerak.
4. THE AxonometricCanvas SHALL kanalizatsiya quvurlarini kulrang (`#64748b`) va kesik chiziq (`dash: [6, 4]`) bilan ko'rsatishi kerak.
5. THE AxonometricCanvas SHALL har bir quvur ustiga diametr yorlig'ini (`"Dn XX"`) ko'rsatishi kerak.
6. THE AxonometricCanvas SHALL har bir sanitariya asbobni CAD uslubidagi ramziy belgi (symbol) sifatida chizishi kerak.
7. THE AxonometricCanvas SHALL qavatlar orasidagi balandlikni (`3.0m`) vertikal o'lchov chizig'i sifatida ko'rsatishi kerak.
8. THE AxonometricCanvas SHALL GOST standartiga mos shtampni pastki o'ng burchakda ko'rsatishi kerak.
9. WHEN chizma tayyor bo'lganda, THE AxonometricCanvas SHALL PDF eksport funksiyasini qo'llab-quvvatlashi kerak.

---

### Requirement 6: API integratsiyasi

**User Story:** As a dasturchi, I want server API si aksonometrik sxemani qo'llab-quvvatlashini, so that client to'g'ri ma'lumot olib chizma chiza olsin.

#### Acceptance Criteria

1. WHEN `/api/generate` endpoint `drawingType: 'plumbing-axonometric'` bilan so'rov olsa, THE Server SHALL PlumbingEngine ni chaqirib `PlumbingSchema` qaytarishi kerak.
2. WHEN `/api/generate` endpoint `drawingType: 'floor-plan'` yoki `drawingType` bo'lmasa, THE Server SHALL mavjud FloorPlanEngine ni chaqirib `DrawingData` qaytarishi kerak.
3. THE Server SHALL `floorCount` parametrini (1-3) `/api/generate` so'rovida qabul qilishi kerak.
4. IF `floorCount` 1 dan kichik yoki 3 dan katta bo'lsa, THEN THE Server SHALL `400 Bad Request` xatosi qaytarishi kerak.
5. THE Server SHALL aksonometrik sxema uchun `/api/export/pdf` endpointini qo'llab-quvvatlashi kerak.

---

### Requirement 7: Quvur parsing va round-trip xususiyati

**User Story:** As a dasturchi, I want PlumbingSchema ni JSON ga serialize va deserialize qilishni, so that ma'lumotlar bazasida saqlash va yuklash to'g'ri ishlaydi.

#### Acceptance Criteria

1. THE PlumbingEngine SHALL `PlumbingSchema` obyektini to'liq JSON ga serialize qila olishi kerak.
2. THE PlumbingEngine SHALL JSON dan `PlumbingSchema` obyektini to'liq deserialize qila olishi kerak.
3. FOR ALL valid PlumbingSchema obyektlari, serialize qilib keyin deserialize qilish asl obyektga teng bo'lishi kerak (round-trip xususiyati).
4. IF noto'g'ri JSON kiritilsa, THEN THE PlumbingEngine SHALL tavsiflovchi xato xabari qaytarishi kerak.

---

### Requirement 8: Loyihani saqlash va yuklash

**User Story:** As a foydalanuvchi, I want aksonometrik sxema loyihasini saqlab, keyinroq ochishni, so that men ishimni yo'qotmasdan davom ettira olaman.

#### Acceptance Criteria

1. WHEN foydalanuvchi aksonometrik sxema loyihasini saqlaganda, THE Server SHALL `drawingData` ichida `drawingType: 'plumbing-axonometric'` va `plumbingSchema` ni ma'lumotlar bazasiga saqlashi kerak.
2. WHEN foydalanuvchi saqlangan loyihani ochganda, THE Project SHALL `drawingType` ga qarab to'g'ri canvas komponentini (`Canvas2D` yoki `AxonometricCanvas`) ko'rsatishi kerak.
3. THE Dashboard SHALL aksonometrik sxema loyihalarini arxitektura loyihalaridan vizual farq bilan (masalan, belgi yoki yorliq) ko'rsatishi kerak.
