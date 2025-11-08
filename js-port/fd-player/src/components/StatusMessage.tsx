import type { JSX } from 'react';

type StatusMessageProps = {
  error?: string | null;
  warning?: string | null;
  info?: string | string[] | null;
  success?: string | null;
};

export const StatusMessage = ({ error, warning, info, success }: StatusMessageProps): JSX.Element | null => {
  if (error) {
    return <p className="status status-error">{error}</p>;
  }
  if (warning) {
    return <p className="status status-warning">{warning}</p>;
  }
  if (info && Array.isArray(info) && info.length > 0) {
    return (
      <ul className="status status-info">
        {info.map((entry, index) => (
          <li key={index}>{entry}</li>
        ))}
      </ul>
    );
  }
  if (info && typeof info === 'string') {
    return <p className="status status-info">{info}</p>;
  }
  if (success) {
    return <p className="status status-success">{success}</p>;
  }
  return null;
};
