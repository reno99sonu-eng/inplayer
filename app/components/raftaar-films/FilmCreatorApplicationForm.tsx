"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function FilmCreatorApplicationForm() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState<string>('');
  
  const [formData, setFormData] = useState({
    channelName: '',
    companyName: '',
    legalName: '',
    handle: '',
    email: '',
    phoneNumber: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/raftaar-films/apply');
      if (res.ok) {
        const data = await res.json();
        const app = data?.application || data;
        if (app && app.status) {
          setStatus(app.status);
          if (app.rejectionReason) {
            setRejectionReason(app.rejectionReason);
          }
        } else {
          setStatus('none');
        }
      } else {
        setStatus('none');
      }
    } catch (err) {
      console.error(err);
      setStatus('none');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/raftaar-films/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setStatus('pending');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to submit application.');
      }
    } catch (err) {
      console.error(err);
      setError('An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading your application status...</div>;
  }

  if (status === 'pending') {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-center">
        <h2 className="text-2xl font-bold text-blue-800 dark:text-blue-300 mb-4">Application Under Review</h2>
        <p className="text-blue-700 dark:text-blue-400 mb-4">
          ⏱️ Review Timeline: 48-72 hours. Once submitted, our editorial admin team will review your channel application. You will be notified in your bell icon and push notifications immediately upon approval or feedback.
        </p>
      </div>
    );
  }

  if (status === 'approved') {
    return (
      <div className="max-w-2xl mx-auto p-8 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
        <h2 className="text-2xl font-bold text-green-800 dark:text-green-300 mb-4">🎉 Approved!</h2>
        <p className="text-green-700 dark:text-green-400 mb-6">
          You are an official Raftaar Films Creator. Go to Studio or Upload to publish your series.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/raftaar-films/studio" className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-md">
            Go to Studio
          </Link>
          <Link href="/upload?type=film" className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded-md">
            Upload Episode
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-4 rounded-lg mb-8">
        <p className="text-yellow-800 dark:text-yellow-300 text-sm">
          <strong>⏱️ Review Timeline: 48-72 hours.</strong> Once submitted, our editorial admin team will review your channel application. You will be notified in your bell icon and push notifications immediately upon approval or feedback.
        </p>
      </div>

      {status === 'rejected' && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-6 rounded-lg mb-8 text-center">
          <h3 className="text-xl font-bold text-red-800 dark:text-red-300 mb-2">Application Needs Revision</h3>
          <p className="text-red-700 dark:text-red-400 mb-4">{rejectionReason}</p>
          <button onClick={() => setStatus('none')} className="bg-red-100 hover:bg-red-200 text-red-800 font-medium py-2 px-4 rounded">
            Re-apply
          </button>
        </div>
      )}

      {status === 'none' && (
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Creator Application</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Channel Name *</label>
                <input required type="text" name="channelName" value={formData.channelName} onChange={handleChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">InPlayer Username / Handle *</label>
                <input required type="text" name="handle" value={formData.handle} onChange={handleChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Personal / Legal Name *</label>
                <input required type="text" name="legalName" value={formData.legalName} onChange={handleChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Production / Company Name</label>
                <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email ID *</label>
                <input required type="email" name="email" value={formData.email} onChange={handleChange} placeholder="creator@example.com" className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number *</label>
                <input required type="tel" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="+91 98765 43210" className="w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
              </div>
            </div>

            <div className="rounded-lg bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600 p-3 text-xs text-slate-600 dark:text-slate-300">
              💡 <strong>Note:</strong> You can upload your Profile Picture and set your Channel Bio and Social Links inside <strong>My Profile</strong> after creating your account.
            </div>

            <div className="pt-4">
              <button disabled={submitting} type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-md transition-colors disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
