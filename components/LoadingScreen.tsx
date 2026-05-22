'use client';

import Header from '@/components/Header';

interface Props {
  songName: string;
  artist: string;
  hideMetadata?: boolean;
}

export default function LoadingScreen({ songName, artist, hideMetadata }: Props) {
  return (
    <div className="flex flex-col h-dvh bg-gray-950 text-white">
      <Header title="זהה את השיר" />

      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
        <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          {hideMetadata ? (
            <p className="text-lg font-semibold text-gray-300">מוצא שיר...</p>
          ) : (
            <>
              <p className="text-lg font-semibold">{songName}</p>
              <p className="text-gray-200">{artist}</p>
            </>
          )}
        </div>
        <p className="text-gray-300 text-sm">מנתח שמע...</p>
      </div>
    </div>
  );
}
