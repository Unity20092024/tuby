
import React from 'react';
import VideoAnalyzer from './components/VideoAnalyzer';

export default function App() {
  return (
    <main className="min-h-screen w-full bg-black text-white">
      <div
        className="relative w-full min-h-screen bg-cover bg-center flex flex-col items-center"
        style={{
          backgroundImage: "url('https://pub-940ccf6255b54fa799a9b01050e6c227.r2.dev/ruixen_moon_2.png')",
          backgroundAttachment: 'fixed',
        }}
      >
        <VideoAnalyzer />
        <footer className="w-full text-center text-neutral-500 py-4 text-sm z-10 bg-black/50">
          © {new Date().getFullYear()} Learning Machine
        </footer>
      </div>
    </main>
  );
}
