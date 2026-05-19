'use client';

interface Props {
  songName: string;
  artist: string;
}

export default function LoadingScreen({ songName, artist }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-950 text-white gap-6 px-8">
      <div className="w-12 h-12 border-4 border-indigo-400 border-t-transparent rounded-full animate-spin" />
      <div className="text-center">
        <p className="text-lg font-semibold">{songName}</p>
        <p className="text-gray-200">{artist}</p>
      </div>
      <p className="text-gray-300 text-sm">Analyzing audio...</p>
    </div>
  );
}
