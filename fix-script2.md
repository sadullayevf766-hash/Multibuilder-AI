bash

cd /home/claude/project && python3 -c "
content = open('client/src/components/Canvas2D.tsx').read()

# Add label rendering to the default case and after each fixture group
# Find the default case render and add a helper function before renderFixture

# Add renderFixtureLabel helper before renderFixture
old = '  const renderFixture = (fixture: PlacedFixture) => {'
new = '''  const renderFixtureLabel = (fixture: PlacedFixture) => {
    const { type, position } = fixture;
    const label = FIXTURE_LABELS[type] || type;
    const dims: Record<string, {w:number,h:number}> = {
      sink:{w:60,h:50}, toilet:{w:40,h:70}, bathtub:{w:80,h:180},
      shower:{w:90,h:90}, stove:{w:60,h:60}, fridge:{w:60,h:65},
      dishwasher:{w:60,h:60}, desk:{w:120,h:60}, bed:{w:160,h:200},
      wardrobe:{w:120,h:60}, sofa:{w:200,h:90}, tv_unit:{w:150,h:45},
      bookshelf:{w:90,h:30}
    };
    const d = dims[type] || {w:50,h:50};
    const cx = position.x + CANVAS_PADDING + d.w/2;
    const cy = position.y + CANVAS_PADDING + d.h/2 + 2;
    const fontSize = d.w < 60 ? 7 : 8;
    return (
      <Text
        key={fixture.id + '-label'}
        x={cx - 20}
        y={cy - fontSize/2}
        text={label}
        fontSize={fontSize}
        fill=\"#444\"
        width={40}
        align=\"center\"
      />
    );
  };

  const renderFixture = (fixture: PlacedFixture) => {'''

content = content.replace(old, new)
open('client/src/components/Canvas2D.tsx', 'w').write(content)
print('renderFixtureLabel added OK' if 'renderFixtureLabel' in content else 'FAIL')
"
Output

renderFixtureLabel added OK