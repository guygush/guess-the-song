'use client';

import Header from '@/components/Header';

interface Props {
  players: { name: string; score: number }[];
  onDone: () => void;
}

export default function SummaryScreen({ players, onDone }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="flex flex-col h-dvh bg-gray-950 text-white">
      <Header title="סיכום המשחק" onBack={onDone} />

      <div className="flex-1 flex flex-col justify-center px-6">
        <div className="flex flex-col gap-3">
          {sorted.map((player, index) => (
            <div
              key={player.name}
              className={`flex items-center justify-between px-5 py-4 rounded-2xl ${
                index === 0 ? 'bg-indigo-600' : 'bg-gray-800'
              }`}
            >
              <span className="font-semibold text-lg">{player.name}</span>
              <span className={`text-2xl font-bold ${index === 0 ? 'text-white' : 'text-gray-300'}`}>
                {player.score}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 pb-8 pt-4">
        <button
          onClick={onDone}
          className="w-full py-3 rounded-2xl bg-gray-800 hover:bg-gray-700 active:bg-gray-600 font-semibold text-lg transition-colors"
        >
          סיום
        </button>
      </div>
    </div>
  );
}
