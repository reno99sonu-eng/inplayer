import React from 'react';
import FilmCreatorApplicationForm from '@/app/components/raftaar-films/FilmCreatorApplicationForm';

export const dynamic = "force-dynamic";

export default function RaftaarFilmsApplyPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4">
            Join Raftaar Films
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300">
            Become a premium micro-drama creator on InPlayer.
          </p>
        </div>

        <FilmCreatorApplicationForm />
        
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">What is Raftaar Films?</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-300">Raftaar Films is our premium tier for vertical micro-dramas. Creators can monetize their short-form series directly with our audience.</p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">How long does the review take?</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-300">Our editorial team reviews all applications within 48-72 hours. You'll receive a notification on InPlayer once a decision is made.</p>
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">What are the requirements?</h3>
              <p className="mt-2 text-gray-600 dark:text-gray-300">We look for high-quality production value, engaging storytelling, and a commitment to producing original vertical series.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
