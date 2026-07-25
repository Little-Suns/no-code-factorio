import React from 'react';
import { useT } from '../i18n';
import './JsonView.css';

interface JsonViewProps {
  value: unknown;
}

export function JsonView({ value }: JsonViewProps) {
  const t = useT();
  const json = JSON.stringify(value, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(json);
  };

  return (
    <div className="json-view">
      <pre>{json}</pre>
      <button className="json-view-copy" onClick={handleCopy} title={t('json.copyTitle')}>
        {t('json.copy')}
      </button>
    </div>
  );
}
