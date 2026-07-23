import { rasterizeLine } from '../../game/rasterize';

// Проверка растеризации пути
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

// Тест 1: линия направо (E)
{
  const result = rasterizeLine({ x: 0, y: 0 }, { x: 3, y: 0 });
  assert(result.length === 3, 'Right line length should be 3');
  assert(result[0].tile.x === 1 && result[0].dir === 1, 'First step should be right (dir=1)');
  assert(result[1].tile.x === 2 && result[1].dir === 1, 'Second step should be right');
  assert(result[2].tile.x === 3 && result[2].dir === 1, 'Third step should be right');
}

// Тест 2: линия вверх (N)
{
  const result = rasterizeLine({ x: 0, y: 3 }, { x: 0, y: 0 });
  assert(result.length === 3, 'Up line length should be 3');
  assert(result[0].tile.y === 2 && result[0].dir === 0, 'First step should be up (dir=0)');
  assert(result[1].tile.y === 1 && result[1].dir === 0, 'Second step should be up');
  assert(result[2].tile.y === 0 && result[2].dir === 0, 'Third step should be up');
}

// Тест 3: линия влево (W)
{
  const result = rasterizeLine({ x: 3, y: 0 }, { x: 0, y: 0 });
  assert(result.length === 3, 'Left line length should be 3');
  assert(result[0].tile.x === 2 && result[0].dir === 3, 'First step should be left (dir=3)');
  assert(result[1].tile.x === 1 && result[1].dir === 3, 'Second step should be left');
  assert(result[2].tile.x === 0 && result[2].dir === 3, 'Third step should be left');
}

// Тест 4: линия вниз (S)
{
  const result = rasterizeLine({ x: 0, y: 0 }, { x: 0, y: 3 });
  assert(result.length === 3, 'Down line length should be 3');
  assert(result[0].tile.y === 1 && result[0].dir === 2, 'First step should be down (dir=2)');
  assert(result[1].tile.y === 2 && result[1].dir === 2, 'Second step should be down');
  assert(result[2].tile.y === 3 && result[2].dir === 2, 'Third step should be down');
}

// Тест 5: диагональ (больший прирост по X)
{
  const result = rasterizeLine({ x: 0, y: 0 }, { x: 5, y: 2 });
  assert(result.length === 7, 'Diagonal (5x2) should have 7 steps');
  // Сначала должны идти шаги по X
  const xSteps = result.filter((s) => s.dir === 1);
  assert(xSteps.length === 5, 'Should have 5 steps right');
  const ySteps = result.filter((s) => s.dir === 2);
  assert(ySteps.length === 2, 'Should have 2 steps down');
}

// Тест 6: диагональ (больший прирост по Y)
{
  const result = rasterizeLine({ x: 0, y: 0 }, { x: 2, y: 5 });
  assert(result.length === 7, 'Diagonal (2x5) should have 7 steps');
  // Сначала должны идти шаги по Y
  const ySteps = result.filter((s) => s.dir === 2);
  assert(ySteps.length === 5, 'Should have 5 steps down first');
  const xSteps = result.filter((s) => s.dir === 1);
  assert(xSteps.length === 2, 'Should have 2 steps right after');
}

// Тест 7: точка в точку (нулевое смещение)
{
  const result = rasterizeLine({ x: 5, y: 5 }, { x: 5, y: 5 });
  assert(result.length === 0, 'Same point should produce no steps');
}

// Тест 8: отрицательные координаты
{
  const result = rasterizeLine({ x: -5, y: -5 }, { x: 0, y: 0 });
  assert(result.length === 10, 'From negative to (0,0) should work');
  assert(result[result.length - 1].tile.x === 0 && result[result.length - 1].tile.y === 0, 'Should end at (0,0)');
}

console.log('✓ All rasterize tests passed');
