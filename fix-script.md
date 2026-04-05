bash

cd /home/claude/project && python3 -c "
content = open('client/src/components/Canvas2D.tsx').read()

# 1. Add FIXTURE_LABELS and ROOM_COLORS constants after imports
insert_after = \"import ShowerSymbol from './symbols/ShowerSymbol';\"
constants = '''
import ShowerSymbol from './symbols/ShowerSymbol';

const FIXTURE_LABELS: Record<string, string> = {
  sink: 'Lavabo', toilet: 'Hojatxona', bathtub: 'Vanna', shower: 'Dush',
  stove: 'Plita', fridge: 'Muzlatgich', dishwasher: 'Idish yuv.',
  desk: 'Stol', bed: 'Karavot', wardrobe: 'Shkaf',
  sofa: 'Divan', tv_unit: 'TV', bookshelf: 'Kitob javon'
};

const ROOM_COLORS: Record<string, string> = {
  kitchen: '#fff9f0', bathroom: '#f0f7ff', bedroom: '#f5fff0',
  living: '#fffff0', office: '#f9f5ff', hallway: '#f5f5f5', default: '#ffffff'
};'''

content = content.replace(
  \"import ShowerSymbol from './symbols/ShowerSymbol';\",
  constants
)
open('client/src/components/Canvas2D.tsx', 'w').write(content)
print('LABELS+COLORS added OK' if 'FIXTURE_LABELS' in content else 'FAIL')
"
Output

LABELS+COLORS added OK