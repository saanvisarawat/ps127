const VARIANT_ICONS = {
  empty: '◌',
  'empty-search': '⌕',
  error: '⚠',
  offline: '⭘',
  info: 'ℹ',
  success: '✓',
};

const VARIANT_DEFAULT_TITLE = {
  empty: 'Nothing here yet',
  'empty-search': 'No results found',
  error: 'Failed to load',
  offline: 'Connection lost',
  info: 'Get started',
  success: 'All clear',
};

export function StatePanel({ variant = 'empty', title, message, onRetry, retryLabel = 'Retry' }) {
  return (
    <div className={`state-panel state-${variant}`}>
      <div className="state-icon">{VARIANT_ICONS[variant] || VARIANT_ICONS.empty}</div>
      <h3>{title || VARIANT_DEFAULT_TITLE[variant]}</h3>
      {message && <p>{message}</p>}
      {onRetry && (
        <button className="btn btn-sm state-retry" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  );
}

export function EmptyState({ variant = 'empty', ...props }) {
  return <StatePanel variant={variant} {...props} />;
}

export function ErrorState({ title, ...props }) {
  return <StatePanel variant="error" title={title || 'Failed to load'} {...props} />;
}
