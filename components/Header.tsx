'use client';

interface Props {
  title: string;
  onBack?: () => void;
}

export default function Header({ title, onBack }: Props) {
  return (
    <div className="relative flex items-center justify-center h-13 flex-shrink-0 px-4">
      {onBack && (
        <button
          onClick={onBack}
          className="absolute left-3 w-9 h-9 flex items-center justify-center rounded-xl text-white/40 hover:text-[#FFDA57] active:text-[#FFDA57]/70 transition-colors"
          aria-label="חזור"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      )}
      <h1 className="text-sm font-bold tracking-wide text-white/70">{title}</h1>
    </div>
  );
}
