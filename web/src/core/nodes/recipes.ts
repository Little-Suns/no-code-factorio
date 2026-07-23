/**
 * Пресеты рецептов для assembler (agent machine).
 * Каждый рецепт — готовый system-промпт с иструкциями для LLM.
 */

export interface Recipe {
  value: string;           // ID для конфига
  label: string;           // Отображаемое имя
  system: string;          // Готовый system-промпт
}

export const RECIPES: Recipe[] = [
  {
    value: 'summarizer',
    label: 'Суммаризатор',
    system: 'Ты сжимаешь текст до 3 предложений, сохраняя суть. Отвечай только результатом, без преамбул.',
  },
  {
    value: 'translator',
    label: 'Переводчик на английский',
    system: 'Переведи текст на английский. Отвечай только переводом.',
  },
  {
    value: 'sentiment',
    label: 'Классификатор тональности',
    system: 'Определи тональность текста. Ответь одним словом: positive, negative или neutral.',
  },
  {
    value: 'critic',
    label: 'Критик',
    system: 'Назови 3 главные слабости текста и предложи улучшения. Кратко, списком.',
  },
  {
    value: 'copywriter',
    label: 'Копирайтер',
    system: 'Преврати текст в короткий пост для соцсетей, до 280 знаков, один эмодзи.',
  },
  {
    value: 'custom',
    label: 'Свой рецепт',
    system: '',
  },
];
