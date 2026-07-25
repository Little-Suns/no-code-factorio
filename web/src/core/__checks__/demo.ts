// @ts-expect-error: Node.js built-in modules used in check runner (tsx)
import { readFileSync } from 'fs';
// @ts-expect-error: Node.js built-in modules used in check runner (tsx)
import { fileURLToPath } from 'url';
// @ts-expect-error: Node.js built-in modules used in check runner (tsx)
import { dirname, join } from 'path';
import { buildGraph } from '../graph';
import type { Entity, MachineKind, Edge } from '../types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Список допустимых типов машин
const VALID_KINDS: Set<MachineKind> = new Set([
  'belt', 'miner', 'assembler', 'duplicator', 'mixer', 'silo',
  'furnace', 'chest', 'lab', 'accumulator', 'webhook', 'manipulator',
]);

// Список допустимых направлений
const VALID_DIRS = new Set([0, 1, 2, 3]);

/**
 * Проверка demo.json:
 * 1. JSON парсится корректно
 * 2. Все entities валидны (kind, pos, dir)
 * 3. buildGraph находит >= 2 edges с to != null (две фабрики)
 * 4. Есть цепочка miner → assembler → silo
 */
export function checkDemo() {
  console.log('Checking demo.json...');

  // Загрузить demo.json
  const demoPath = join(__dirname, '../../..', 'public', 'demo.json');
  let demoData: unknown;
  try {
    const content = readFileSync(demoPath, 'utf-8');
    demoData = JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load or parse demo.json: ${error}`);
  }

  // Проверить структуру
  if (!demoData || typeof demoData !== 'object') {
    throw new Error('demo.json must be an object');
  }
  if (!Array.isArray((demoData as any).entities)) {
    throw new Error('demo.json.entities must be an array');
  }

  const entities = (demoData as any).entities as Entity[];

  if (entities.length === 0) {
    throw new Error('demo.json.entities must not be empty');
  }

  // Валидировать каждый entity
  const entityMap: Record<string, Entity> = {};
  for (const entity of entities) {
    if (!entity.id || typeof entity.id !== 'string') {
      throw new Error(`Entity missing or invalid id: ${JSON.stringify(entity)}`);
    }
    if (!VALID_KINDS.has(entity.kind)) {
      throw new Error(`Entity ${entity.id} has invalid kind: ${entity.kind}`);
    }
    if (!entity.pos || typeof entity.pos.x !== 'number' || typeof entity.pos.y !== 'number') {
      throw new Error(`Entity ${entity.id} has invalid pos: ${JSON.stringify(entity.pos)}`);
    }
    if (!VALID_DIRS.has(entity.dir)) {
      throw new Error(`Entity ${entity.id} has invalid dir: ${entity.dir}`);
    }
    if (typeof entity.config !== 'object' || entity.config === null) {
      throw new Error(`Entity ${entity.id} has invalid config: ${JSON.stringify(entity.config)}`);
    }
    entityMap[entity.id] = entity;
  }
  console.log(`✓ All ${entities.length} entities are valid`);

  // Извлечь граф
  let edges: Edge[];
  try {
    edges = buildGraph(entityMap);
  } catch (error) {
    throw new Error(`Failed to build graph: ${error}`);
  }

  // Проверить >= 2 edges с to != null (две ветки)
  const connectedEdges = edges.filter(e => e.to !== null);
  if (connectedEdges.length < 2) {
    throw new Error(
      `Expected >= 2 connected edges (two factories), got ${connectedEdges.length}. ` +
      `Edges: ${edges.map(e => `${e.from}:${e.branch}→${e.to}`).join(', ')}`
    );
  }
  console.log(`✓ Found ${connectedEdges.length} connected edges`);

  // Найти цепочку miner → assembler → silo. Манипулятор обязателен для любой передачи
  // станок↔станок (docs/03), поэтому каждый «хоп» здесь на деле miner→manipulator→assembler
  // и assembler→manipulator→silo — используем BFS по edges, не завязываясь на число хопов.
  const miners = Object.values(entityMap).filter(e => e.kind === 'miner');
  const assemblers = Object.values(entityMap).filter(e => e.kind === 'assembler');
  const silos = Object.values(entityMap).filter(e => e.kind === 'silo');

  if (miners.length === 0) throw new Error('No miners in demo.json');
  if (assemblers.length === 0) throw new Error('No assemblers in demo.json');
  if (silos.length === 0) throw new Error('No silos in demo.json');

  // BFS: достижим ли узел kind=targetKind от startId по цепочке edges (любая длина)
  function reachesKind(startId: string, targetKind: MachineKind): string | null {
    const visited = new Set<string>([startId]);
    const queue: string[] = [startId];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const edge of edges) {
        if (edge.from !== cur || edge.to === null || visited.has(edge.to)) continue;
        const node = entityMap[edge.to];
        if (!node) continue;
        if (node.kind === targetKind) return edge.to;
        visited.add(edge.to);
        queue.push(edge.to);
      }
    }
    return null;
  }

  let chainFound: { miner: string; assembler: string; silo: string } | null = null;
  for (const miner of miners) {
    const reachedAssembler = reachesKind(miner.id, 'assembler');
    if (!reachedAssembler) continue;
    const reachedSilo = reachesKind(reachedAssembler, 'silo');
    if (reachedSilo) {
      chainFound = { miner: miner.id, assembler: reachedAssembler, silo: reachedSilo };
      break;
    }
  }

  if (!chainFound) {
    throw new Error('Missing chain: no miner →(…manipulator…)→ assembler →(…manipulator…)→ silo');
  }
  console.log(`✓ Found chain: ${chainFound.miner} → ${chainFound.assembler} → ${chainFound.silo}`);

  console.log('✓ Demo.json validation passed');
}

// Запустить проверку
checkDemo();
