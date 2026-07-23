/**
 * Шаблонизация: {{path.to.field}} подставляет значения из data.
 * Не-строка → JSON.stringify, нет пути → пустая строка.
 */
export function tpl(s: string, data: unknown): string {
  if (typeof s !== 'string') return '';

  return s.replace(/\{\{([\w.[\]]+)\}\}/g, (match, path: string) => {
    const value = getNestedValue(data, path);
    if (value === undefined || value === null) return '';
    if (typeof value === 'string') return value;
    return JSON.stringify(value);
  });
}

/**
 * Извлечение значения по пути из объекта.
 * Поддерживает: 'a.b.c', 'a[0]', 'a.b[0].c'
 */
function getNestedValue(obj: unknown, path: string): unknown {
  const parts = parsePath(path);

  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current === 'object') {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }

  return current;
}

/**
 * Парсит path вида 'a.b[0].c' в массив ключей ['a', 'b', '0', 'c']
 */
function parsePath(path: string): string[] {
  const parts: string[] = [];
  let current = '';

  for (let i = 0; i < path.length; i++) {
    const ch = path[i];
    if (ch === '.') {
      if (current) parts.push(current);
      current = '';
    } else if (ch === '[') {
      if (current) parts.push(current);
      current = '';
      // Читаем до ']'
      i++;
      while (i < path.length && path[i] !== ']') {
        current += path[i];
        i++;
      }
      if (current) parts.push(current);
      current = '';
    } else if (ch === ']') {
      // Пропускаем
    } else {
      current += ch;
    }
  }

  if (current) parts.push(current);
  return parts;
}
