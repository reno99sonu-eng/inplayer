'use client';
import React, { useState, useEffect } from 'react';
import { Search, X, Mic } from 'lucide-react';

interface FilmSearchBarProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}

export default function FilmSearchBar({ value, onChange, placeholder = "Search for micro-series..." }: FilmSearchBarProps) {
  const [isListening, setIsListening] = useState(false);
  const [supportSpeech, setSupportSpeech] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setSupportSpeech(false);
      }
    }
  }, []);

  const toggleListen = () => {
    if (isListening) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onChange(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error(event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto group">
      <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-zinc-400 group-focus-within:text-orange-500 transition-colors" />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block w-full pl-11 pr-24 py-3 sm:text-sm bg-zinc-800/80 border border-zinc-700/50 rounded-full text-white placeholder-zinc-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent backdrop-blur-sm transition-all shadow-lg"
        placeholder={placeholder}
      />
      <div className="absolute inset-y-0 right-0 flex items-center pr-2 space-x-1">
        {value && (
          <button onClick={() => onChange('')} className="p-2 text-zinc-400 hover:text-white transition-colors rounded-full hover:bg-zinc-700/50">
            <X className="h-4 w-4" />
          </button>
        )}
        {supportSpeech && (
          <button 
            onClick={toggleListen}
            title="Search by voice"
            className={`p-2 rounded-full transition-all ${
              isListening 
                ? 'bg-orange-500/20 text-orange-500 animate-pulse shadow-[0_0_10px_rgba(249,115,22,0.5)]' 
                : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
            }`}
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
