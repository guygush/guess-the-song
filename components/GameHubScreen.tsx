'use client';

interface Props {
  onSelectGame: (game: 'guess-the-song' | 'one-word') => void;
}

const GAMES = [
  {
    id: 'guess-the-song' as const,
    emoji: '🎵',
    title: 'זהה את השיר',
    subtitle: 'נגן קטע ונחשו',
    accentColor: '#ffdb2c',
    borderColor: '#b8860b',
    shadowColor: '#c4a882',
  },
  {
    id: 'one-word' as const,
    emoji: '💬',
    title: 'במילה אחת',
    subtitle: 'תנו רמזים, נחשו מילה',
    accentColor: '#a9e4ff',
    borderColor: '#5cade2',
    shadowColor: '#4a9acc',
  },
];

export default function GameHubScreen({ onSelectGame }: Props) {
  return (
    <div className="flex flex-col h-dvh play-page overflow-hidden">

      {/* Header */}
      <div className="play-header flex-shrink-0">
        <div className="h-3" />
        <div className="play-wavy opacity-50" />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8">

        {/* Logo */}
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="צפוף" className="h-24 w-auto mx-auto mb-2" />
          <p className="text-brown-light text-sm">ערב גיבוש משפחתי</p>
        </div>

        {/* Game cards */}
        <div className="flex flex-col gap-4 w-full max-w-xs">
          {GAMES.map(game => (
            <button
              key={game.id}
              onClick={() => onSelectGame(game.id)}
              className="w-full candy-card rounded-3xl p-5 flex items-center gap-4 active:translate-y-1 transition-transform"
              style={{ borderRadius: '1.5rem' }}
            >
              {/* Icon */}
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 glossy-btn"
                style={{
                  background: `linear-gradient(to bottom, ${game.accentColor}dd, ${game.accentColor})`,
                  border: `2px solid ${game.borderColor}`,
                  boxShadow: `0 3px 10px ${game.shadowColor}88, 0 1px 2px rgba(0,0,0,0.07)`,
                }}
              >
                {game.emoji}
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0 text-right">
                <p className="font-bold text-lg text-brown leading-tight">{game.title}</p>
              </div>

              {/* Arrow */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 glossy-btn btn-candy-yellow"
                style={{ minWidth: 36 }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M4 6L8 2M4 6L8 10" stroke="#5c3511" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
