import React from 'react';
import './JsonView.css';

interface JsonViewProps {
  value: unknown;
}

export function JsonView({ value }: JsonViewProps) {
  const json = JSON.stringify(value, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(json);
  };

  return (
    <div className="json-view">
      <pre>{json}</pre>
      <button className="json-view-copy" onClick={handleCopy} title="Copy to clipboard">
        Copy
      </button>
    </div>
  );
}
