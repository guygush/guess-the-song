'use client';

interface Props {
  title: string;
  onBack?: () => void;
  wavy?: boolean;
}

export default function Header({ title, onBack, wavy = true }: Props) {
  return (
    <div className="play-header flex-shrink-0">
      <div className="relative flex items-center justify-center px-4 py-3">
        {onBack && (
          <button
            onClick={onBack}
            className="absolute left-4 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: '#f4e6d4', border: '2px solid #dcc9ad', boxShadow: '0 3px 8px rgba(196,168,130,0.3), 0 1px 2px rgba(0,0,0,0.06)' }}
            aria-label="חזור"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M15 19l-7-7 7-7" stroke="#8b5e34" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        )}
        <h1 className="text-sm font-bold text-brown">{title}</h1>
      </div>
      {wavy && <div className="play-wavy opacity-50" />}
    </div>
  );
}
