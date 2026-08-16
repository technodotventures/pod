import './PodLoader.css';

type PodLoaderProps = {
  className?: string;
  label?: string;
  size?: number;
};

/** Pod's fill animation, adapted from the supplied Lottie artwork. */
export function PodLoader({ className = '', label = 'Loading…', size = 44 }: PodLoaderProps) {
  return (
    <div className={`pod-loader ${className}`.trim()} role="status" aria-label={label}>
      <span className="pod-loader__tile" style={{ width: size, height: size }} aria-hidden="true">
        <svg className="pod-loader__art" viewBox="0 0 512 512" focusable="false">
          <g transform="translate(218 68)">
            <path className="pod-loader__sparkle pod-loader__sparkle--medium" d="M0-32 9-9 32 0 9 9 0 32-9 9-32 0-9-9Z" />
          </g>
          <g transform="translate(322 105)">
            <path className="pod-loader__sparkle pod-loader__sparkle--large" d="M0-44 12-12 44 0 12 12 0 44-12 12-44 0-12-12Z" />
          </g>
          <g transform="translate(192 148)">
            <path className="pod-loader__sparkle pod-loader__sparkle--small" d="M0-22 7-7 22 0 7 7 0 22-7 7-22 0-7-7Z" />
          </g>
          <rect className="pod-loader__lid" x="96" y="179" width="320" height="22" rx="11" />
          <path className="pod-loader__body" d="M140 216H372L340 392 298 444H214L172 392Z" />
        </svg>
      </span>
      {label && <span className="pod-loader__label">{label}</span>}
    </div>
  );
}
