'use client';

interface Props {
  title: string;
  onBack?: () => void;
}

export default function Header({ title, onBack }: Props) {
  return (
    <div className="relative flex items-center justify-center h-14 bg-gray-900 border-b border-gray-800 flex-shrink-0">
      {onBack && (
        <button
          onClick={onBack}
          className="absolute left-3 w-9 h-9 flex items-center justify-center rounded-xl text-gray-300 hover:text-white hover:bg-gray-800 active:bg-gray-700 transition-colors"
          aria-label="חזור"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
      <h1 className="text-base font-bold">{title}</h1>
    </div>
  );
}
