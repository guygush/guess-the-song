'use client';

interface Props {
  players: { name: string; score: number }[];
  onDone: () => void;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function SummaryScreen({ players, onDone }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);
  const max = sorted[0]?.score || 1;

  return (
    <div className="flex flex-col h-dvh bg-[#0C0C0C] text-white overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-center h-13 flex-shrink-0 px-4">
        <h1 className="text-sm font-bold tracking-wide text-white/70">סיכום משחק</h1>
      </div>

      {/* Trophy */}
      <div className="text-center pt-2 pb-4 flex-shrink-0">
        <div className="text-4xl mb-1">🏆</div>
        <p className="text-white/40 text-xs tracking-widest uppercase">תוצאות</p>
      </div>

      {/* Leaderboard */}
      <div className="flex-1 flex flex-col justify-center px-5 gap-2.5">
        {sorted.map(({ name, score }, i) => (
          <div
            key={name}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border ${
              i === 0
                ? 'bg-[#FFDA57]/10 border-[#FFDA57]/25'
                : 'bg-[#141414] border-white/[0.06]'
            }`}
          >
            <span className="text-xl w-7 text-center flex-shrink-0">{MEDALS[i] ?? `${i + 1}.`}</span>
            <span className={`font-bold text-base flex-1 ${i === 0 ? 'text-[#FFDA57]' : 'text-white'}`}>
              {name}
            </span>
            {/* score bar */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-16 h-1.5 bg-white/8 rounded-full overflow-hidden" dir="ltr">
                <div
                  className="h-full rounded-full bg-[#FFDA57]"
                  style={{ width: `${(score / max) * 100}%` }}
                />
              </div>
              <span className="font-black text-lg w-6 text-right" dir="ltr">{score}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Done button */}
      <div className="px-5 pb-safe pt-3 flex-shrink-0">
        <button
          onClick={onDone}
          className="w-full py-4 rounded-2xl bg-[#FFDA57] text-[#0C0C0C] font-black text-lg active:opacity-80 transition-opacity"
        >
          סיום
        </button>
      </div>
    </div>
  );
}
