// Полифилл Web Crypto для check runner'а под node/tsx (см. run.ts) — core/engine.ts и
// core/blueprint.ts используют crypto.randomUUID(), а на некоторых связках Node/tsx
// глобальный crypto не проставлен автоматически. На браузер/сборку это не влияет —
// файл импортируется только из __checks__/run.ts, первым (до остальных проверок).
// @ts-expect-error: Node.js built-in module used in check runner (tsx), как в demo.ts
import { webcrypto } from 'node:crypto';

if (typeof (globalThis as any).crypto?.randomUUID !== 'function') {
  (globalThis as any).crypto = webcrypto;
}

