'use client';

interface Props {
  players: { name: string; score: number }[];
  onDone: () => void;
}

const MEDALS = ['🥇', '🥈', '🥉'];
const PLAYER_COLORS = ['#5EB3F8', '#FF6B9D', '#3ECF8E', '#B69AF0', '#FF8C42', '#FFDA57'];

export default function SummaryScreen({ players, onDone }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const max = sorted[0]?.score || 1;

  return (
    <div className="flex flex-col h-dvh play-page overflow-hidden">

      {/* Header */}
      <div className="play-header flex-shrink-0">
        <div className="flex items-center justify-center px-4 py-3">
          <h1 className="text-sm font-bold text-brown">סיכום משחק</h1>
        </div>
        <div className="play-wavy opacity-50" />
      </div>

      {/* Trophy */}
      <div className="text-center pt-4 pb-3 flex-shrink-0">
        <div className="text-5xl mb-1">🏆</div>
        <p className="text-brown-light text-xs tracking-widest uppercase font-semibold">תוצאות</p>
      </div>

      {/* Leaderboard */}
      <div className="flex-1 flex flex-col justify-center px-5 gap-3 min-h-0 overflow-y-auto">
        {sorted.map(({ name, score }, i) => {
          const color = PLAYER_COLORS[i % PLAYER_COLORS.length];
          const isFirst = i === 0;
          return (
            <div
              key={name}
              className="flex items-center gap-3 px-4 py-3.5 rounded-3xl candy-card"
              style={isFirst
                ? { background: 'rgba(255,219,44,0.15)', borderColor: '#b8860b', boxShadow: '0 3px 8px rgba(196,168,130,0.3), 0 1px 2px rgba(0,0,0,0.06)' }
                : { boxShadow: '0 3px 8px rgba(196,168,130,0.3), 0 1px 2px rgba(0,0,0,0.06)' }
              }
            >
              <span className="text-xl w-8 text-center flex-shrink-0">{MEDALS[i] ?? `${i + 1}.`}</span>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: color }}>
                {name.charAt(0)}
              </div>
              <span className="font-bold text-base flex-1 text-brown">{name}</span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="w-16 h-2 rounded-full overflow-hidden" style={{ background: '#e9dcc5' }} dir="ltr">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${(score / max) * 100}%`, background: isFirst ? '#ffbf00' : '#c4a882' }}
                  />
                </div>
                <span className="font-black text-lg w-6 text-right text-brown" dir="ltr">{score}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Done button */}
      <div className="px-5 pb-safe pt-4 flex-shrink-0">
        <button
          onClick={onDone}
          className="w-full py-5 rounded-[2.5rem] font-bold text-2xl glossy-btn btn-candy-yellow active:opacity-80 transition-opacity"
          style={{ color: '#5c3511' }}
        >
          סיום
        </button>
      </div>
    </div>
  );
}
