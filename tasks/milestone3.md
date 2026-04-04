Create /server/ai/GeminiParser.ts

System prompt rules:
- Input: user's natural language description
- Output: ONLY this JSON structure, nothing else:

{
  "roomType": "bathroom" | "kitchen" | "office" | "apartment",
  "dimensions": { "width": number, "length": number },
  "fixtures": [
    { 
      "type": "toilet"|"sink"|"bathtub"|"shower"|"stove"|"fridge",
      "wall": "north"|"south"|"east"|"west",
      "offset": number (meters from corner)
    }
  ],
  "doors": [{ "wall": "south", "position": "center"|number }],
  "windows": [{ "wall": "north", "count": number }],
  "notes": "any special requirements"
}

Validation: if dimensions missing, default 3x4.
If fixture wall conflicts, auto-resolve.
Never output coordinates. Never output pipe paths.