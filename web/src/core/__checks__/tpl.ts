import { tpl } from '../tpl';

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(`Assert failed: ${msg}`);
  }
}

console.log('Testing tpl...');

// Простая подстановка
let result = tpl('Hello {{name}}', { name: 'World' });
assert(result === 'Hello World', `Simple substitution failed: got "${result}"`);

// Вложенное поле
result = tpl('Value: {{obj.field}}', { obj: { field: 'test' } });
assert(result === 'Value: test', `Nested field failed: got "${result}"`);

// Индекс массива
result = tpl('First: {{arr[0]}}', { arr: ['alpha', 'beta'] });
assert(result === 'First: alpha', `Array index failed: got "${result}"`);

// Не-строка → JSON.stringify
result = tpl('Data: {{val}}', { val: { x: 1, y: 2 } });
assert(result === 'Data: {"x":1,"y":2}', `Object stringify failed: got "${result}"`);

// Отсутствующий путь → пустая строка
result = tpl('Missing: {{missing}}', {});
assert(result === 'Missing: ', `Missing field should give empty string: got "${result}"`);

console.log('✓ tpl checks OK');
