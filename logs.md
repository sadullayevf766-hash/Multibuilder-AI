[GEMINI] Using model: gemini-2.0-flash
[GEMINI] API key prefix: AIzaSyB0
Gemini API error, falling back to demo mode: Error: Gemini API error: Too Many Requests
    at GeminiParser.callGemini (D:\Multibuild AI\server\src\ai\GeminiParser.ts:298:13)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async GeminiParser.parseDescription (D:\Multibuild AI\server\src\ai\GeminiParser.ts:76:30)
    at async <anonymous> (D:\Multibuild AI\server\src\index.ts:35:20)
[PARSER OUTPUT] {
  "id": "floorplan-1775129198798",
  "name": "2 xonali kvartira 60 kv.m",
  "totalArea": 60,
  "rooms": [
    {
      "id": "room_living",
      "roomSpec": {
        "id": "room-living-1775129198798",
        "name": "Zal",
        "width": 5,
        "length": 4,
        "fixtures": [
          {
            "id": "f0",
            "type": "sofa",
            "wall": "south",
            "needsWater": false,
            "needsDrain": false
          },
          {
            "id": "f1",
            "type": "tv_unit",
            "wall": "north",
            "needsWater": false,
            "needsDrain": false
          }
        ],
        "doors": [
          {
            "id": "door-0",
            "wall": "south",
            "width": 0.9
          }
        ],
        "windows": [
          {
            "id": "w0",
            "wall": "north",
            "width": 1.2
          }
        ]
      },
      "position": {
        "x": 0,
        "y": 0
      },
      "connections": []
    },
    {
      "id": "room_kitchen",
      "roomSpec": {
        "id": "room-kitchen-1775129198798",
        "name": "Oshxona",
        "width": 3,
        "length": 4,
        "fixtures": [
          {
            "id": "f0",
            "type": "stove",
            "wall": "north",
            "needsWater": false,
            "needsDrain": false
          },
          {
            "id": "f1",
            "type": "sink",
            "wall": "north",
            "needsWater": true,
            "needsDrain": true
          },
          {
            "id": "f2",
            "type": "fridge",
            "wall": "west",
            "needsWater": false,
            "needsDrain": false
          }
        ],
        "doors": [
          {
            "id": "door-0",
            "wall": "south",
            "width": 0.9
          }
        ],
        "windows": [
          {
            "id": "w0",
            "wall": "north",
            "width": 1.2
          }
        ]
      },
      "position": {
        "x": 5,
        "y": 0
      },
      "connections": []
    },
    {
      "id": "room_bed1",
      "roomSpec": {
        "id": "room-bedroom-1775129198798",
        "name": "Yotoqxona",
        "width": 4,
        "length": 4,
        "fixtures": [
          {
            "id": "f0",
            "type": "bed",
            "wall": "west",
            "needsWater": false,
            "needsDrain": false
          },
          {
            "id": "f1",
            "type": "wardrobe",
            "wall": "east",
            "needsWater": false,
            "needsDrain": false
          }
        ],
        "doors": [
          {
            "id": "door-0",
            "wall": "south",
            "width": 0.9
          }
        ],
        "windows": [
          {
            "id": "w0",
            "wall": "north",
            "width": 1.2
          }
        ]
      },
      "position": {
        "x": 0,
        "y": 4
      },
      "connections": []
    },
    {
      "id": "room_bathroom",
      "roomSpec": {
        "id": "room-bathroom-1775129198798",
        "name": "Hammom",
        "width": 2,
        "length": 2,
        "fixtures": [
          {
            "id": "f0",
            "type": "sink",
            "wall": "north",
            "needsWater": true,
            "needsDrain": true
          },
          {
            "id": "f1",
            "type": "toilet",
            "wall": "south",
            "needsWater": false,
            "needsDrain": true
          }
        ],
        "doors": [
          {
            "id": "door-0",
            "wall": "south",
            "width": 0.9
          }
        ],
        "windows": [
          {
            "id": "w0",
            "wall": "north",
            "width": 1.2
          }
        ]
      },
      "position": {
        "x": 4,
        "y": 4
      },
      "connections": []
    },
    {
      "id": "room_hallway",
      "roomSpec": {
        "id": "room-hallway-1775129198798",
        "name": "Koridor",
        "width": 2,
        "length": 2,
        "fixtures": [],
        "doors": [
          {
            "id": "door-0",
            "wall": "south",
            "width": 0.9
          }
        ],
        "windows": [
          {
            "id": "w0",
            "wall": "north",
            "width": 1.2
          }
        ]
      },
      "position": {
        "x": 6,
        "y": 4
      },
      "connections": []
    }
  ],
  "buildingDimensions": {
    "width": 8,
    "length": 8
  }
}
[ENGINE] Room room_living at (0, 0)
[ENGINE] Room room_kitchen at (5, 0)
[ENGINE] Room room_bed1 at (0, 4)
[ENGINE] Room room_bathroom at (4, 4)
[ENGINE] Room room_hallway at (6, 4)
[ENGINE] received: 5 4
[ENGINE] received: 3 4
[PIPE FINAL] cold path: [{"x":80,"y":48},{"x":80,"y":25},{"x":275,"y":25}]
[PIPE FINAL] hot path: [{"x":80,"y":48},{"x":80,"y":33},{"x":275,"y":33}]
[PIPE FINAL] drain path: [{"x":80,"y":73},{"x":80,"y":385}]
[ENGINE] received: 4 4
[ENGINE] received: 2 2
[PIPE FINAL] cold path: [{"x":80,"y":48},{"x":80,"y":25},{"x":175,"y":25}]
[PIPE FINAL] hot path: [{"x":80,"y":48},{"x":80,"y":33},{"x":175,"y":33}]
[PIPE FINAL] drain path: [{"x":80,"y":73},{"x":80,"y":185}]
[PIPE FINAL] drain path: [{"x":120,"y":107},{"x":120,"y":200}]
[ENGINE] received: 2 2