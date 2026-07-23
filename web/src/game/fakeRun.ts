// Тестовая функция для ручной проверки Transport
import { useStore } from '../state/store';
import { createTransport, consumePacket } from './packets';
import { buildGraph } from '../core/graph';

export async function fakeRun(): Promise<void> {
  console.log('🧪 FakeRun: проверка Transport и пакетов');

  const state = useStore.getState();
  const entities = state.entities;

  // Проверить минимум 2 станка и ленты
  const nonBeltEntities = Object.values(entities).filter((e) => e.kind !== 'belt');
  if (nonBeltEntities.length < 2) {
    console.warn('❌ FakeRun: нужно минимум 2 станка');
    return;
  }

  const belts = Object.values(entities).filter((e) => e.kind === 'belt');
  if (belts.length === 0) {
    console.warn('❌ FakeRun: нужно минимум одну ленту');
    return;
  }

  // Построить граф
  const edges = buildGraph(entities);
  if (edges.length === 0) {
    console.warn('❌ FakeRun: граф пуст (нет рёбер)');
    return;
  }

  console.log(`✓ Граф построен: ${edges.length} рёбер`);

  // Найти первый путь с длиной > 2
  const testEdge = edges.find((e) => e.path.length >= 2);
  if (!testEdge) {
    console.warn('❌ FakeRun: нет пути для тестирования');
    return;
  }

  console.log(`✓ Тестовый путь: ${testEdge.path.length} тайлов`);

  // Создать транспорт и пакет
  const transport = createTransport();
  const packetId = `fake-${crypto.randomUUID().slice(0, 8)}`;
  const testPacket = {
    id: packetId,
    item: 'text' as const,
    sizeHint: 1000,
    ttl: 64,
  };

  console.log(`📦 Пакет ${packetId} начинает путешествие...`);

  // Гонять пакет по пути
  try {
    await transport.move(packetId, testEdge.path, testPacket.item, testPacket.sizeHint);
    console.log(`✅ Пакет прошёл весь путь (${testEdge.path.length * 400}мс)`);

    // Симулировать consume
    setTimeout(() => {
      consumePacket(packetId);
      console.log(`✅ Пакет втянут в станок`);
    }, 100);
  } catch (e) {
    console.error('❌ FakeRun ошибка:', e);
  }
}

// Регистрация для ручной проверки в консоли
if (import.meta.env.DEV) {
  (window as any).__fakeRun = fakeRun;
  console.log('💡 Используй window.__fakeRun() в консоли для тестирования Transport');
}
