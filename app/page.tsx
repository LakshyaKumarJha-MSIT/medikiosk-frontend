'use client';

import { useState, useRef, useEffect } from 'react';

interface UploadedDoc {
  filename: string;
  file_url: string;
}

interface AppointmentDetails {
  appointment_date: string;
  appointment_time: string;
  doctor_notes: string;
  prescription_text: string;
  pdf_url: string;
}

interface PatientHistoryRecord {
  session_id: string;
  created_at: string;
  patient_name: string;
  symptoms: string;
  documents: UploadedDoc[];
  appointment?: AppointmentDetails;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'checkin' | 'history'>('checkin');

  // Form States
  const [patientName, setPatientName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // History Tab States
  const [searchQuery, setSearchQuery] = useState('');
  const [historyRecords, setHistoryRecords] = useState<PatientHistoryRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // PDF Preview Modal State
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle ESC key and page scroll during PDF preview modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePdfUrl(null);
    };
    if (activePdfUrl) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'unset';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [activePdfUrl]);

  // Polling logic for live prescription updates after check-in submission
  useEffect(() => {
    if (!sessionId || !submitted || appointment) return;

    const controller = new AbortController();

    const checkAppointment = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/v1/intake/session/${sessionId}`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.appointment) setAppointment(data.appointment);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Polling error:', err);
        }
      }
    };

    checkAppointment();
    const interval = setInterval(checkAppointment, 3000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [sessionId, submitted, appointment]);

  const ensureSessionCreated = async (): Promise<string | null> => {
    if (sessionId) return sessionId;

    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/intake/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patient_name: patientName.trim() || 'Pending Registration',
          contact_number: contactNumber.trim() || 'Pending',
          contact_email: contactEmail.trim() || 'Pending',
          symptoms: symptoms.trim() || 'Pending',
        }),
      });

      if (!res.ok) throw new Error('Failed to register session');
      const data = await res.json();
      setSessionId(data.session_id);
      return data.session_id;
    } catch (err) {
      setErrorMessage('Could not establish session with server.');
      return null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const currentSessionId = await ensureSessionCreated();
      if (!currentSessionId) throw new Error('Session creation failed.');

      const formData = new FormData();
      formData.append('session_id', currentSessionId);
      formData.append('file', file);

      const uploadRes = await fetch('http://127.0.0.1:8000/api/v1/document/upload', {
        method: 'POST',
        body: formData,
      });

      if (uploadRes.ok) {
        const data = await uploadRes.json();
        setUploadedDocs((prev) => [...prev, { filename: data.filename, file_url: data.file_url }]);
      } else {
        throw new Error('File upload failed.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error uploading PDF.';
      setErrorMessage(msg);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmitIntake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName.trim() || !symptoms.trim() || loading) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      let currentSessionId = sessionId;

      if (!currentSessionId) {
        currentSessionId = await ensureSessionCreated();
      } else {
        await fetch('http://127.0.0.1:8000/api/v1/intake/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: currentSessionId,
            patient_name: patientName,
            contact_number: contactNumber,
            contact_email: contactEmail,
            symptoms: symptoms,
          }),
        });
      }

      if (currentSessionId) {
        setSubmitted(true);
      }
    } catch (err) {
      setErrorMessage('Failed to submit check-in form.');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchHistory = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setHistoryLoading(true);
    setHasSearched(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`http://127.0.0.1:8000/api/v1/patient/history?contact=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setHistoryRecords(Array.isArray(data.history) ? data.history : []);
      } else {
        throw new Error('Failed to fetch patient history.');
      }
    } catch (err) {
      setErrorMessage('Could not load history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const resetFormForNewPatient = () => {
    setPatientName('');
    setContactNumber('');
    setContactEmail('');
    setSymptoms('');
    setUploadedDocs([]);
    setActivePdfUrl(null);
    setSessionId(null);
    setAppointment(null);
    setSubmitted(false);
    setErrorMessage(null);
  };
  return (
    <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
        
        {/* Navigation Tabs */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 mb-6">
          <button
            type="button"
            onClick={() => { setActiveTab('checkin'); setErrorMessage(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'checkin' ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            📋 Patient Check-in
          </button>
          <button
            type="button"
            onClick={() => { setActiveTab('history'); setErrorMessage(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
              activeTab === 'history' ? 'bg-teal-500 text-slate-950' : 'text-slate-400 hover:text-white'
            }`}
          >
            📂 Past Records & Prescriptions
          </button>
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-xs flex justify-between items-center">
            <span>⚠️ {errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="text-red-400 hover:text-white ml-2">✕</button>
          </div>
        )}

        {activeTab === 'checkin' ? (
          <div>
            <header className="border-b border-slate-800 pb-4 mb-6 text-center">
              <h1 className="text-2xl font-bold text-teal-400">MediKiosk Check-in</h1>
              <p className="text-slate-400 text-xs mt-1">Submit Reports & Receive Live Prescriptions</p>
            </header>

            {submitted ? (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-teal-500/10 text-teal-400 border border-teal-500/20 text-2xl">
                    ✓
                  </div>
                  <h2 className="text-lg font-semibold text-white">Check-in Complete</h2>
                  <p className="text-slate-400 text-xs">Session ID: <span className="font-mono text-teal-300">{sessionId}</span></p>

                  {uploadedDocs.length > 0 && (
                    <div className="mt-3 bg-slate-950 p-3 rounded-lg border border-slate-800 text-left">
                      <p className="text-[11px] font-semibold text-teal-400 mb-2">📎 Attached Medical Reports:</p>
                      <div className="space-y-1">
                        {uploadedDocs.map((doc) => (
                          <div key={doc.file_url} className="text-xs text-slate-300 flex justify-between items-center bg-slate-900 p-2 rounded border border-slate-800">
                            <span className="truncate max-w-[240px]">📄 {doc.filename}</span>
                            <button
                              type="button"
                              onClick={() => setActivePdfUrl(doc.file_url)}
                              className="text-[10px] bg-teal-500/20 hover:bg-teal-500/40 text-teal-300 px-2 py-0.5 rounded transition"
                            >
                              👁️ View Report
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {appointment ? (
                  <div className="bg-slate-950 border border-teal-500/40 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                      <span className="text-xs font-bold text-teal-400 uppercase">Confirmed Appointment</span>
                      <span className="text-[10px] bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded font-mono">
                        {appointment.appointment_date} @ {appointment.appointment_time}
                      </span>
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-slate-400">Doctor's Prescribed Medications:</p>
                      <p className="text-xs text-slate-200 mt-1 whitespace-pre-line">{appointment.prescription_text}</p>
                    </div>

                    <a
                      href={appointment.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold py-2.5 rounded-lg text-xs transition flex items-center justify-center gap-2"
                    >
                      📄 Download Prescription PDF
                    </a>
                  </div>
                ) : (
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center space-y-2">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block animate-ping mr-2"></span>
                    <span className="text-xs text-amber-300">Awaiting Doctor Review...</span>
                  </div>
                )}

                <button
                  type="button"
                  onClick={resetFormForNewPatient}
                  className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2 rounded-lg transition"
                >
                  + Register Another Patient
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitIntake} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="e.g. Lakshya Jha"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Number</label>
                    <input
                      type="tel"
                      value={contactNumber}
                      onChange={(e) => setContactNumber(e.target.value)}
                      placeholder="+1 555-0199"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Email</label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="patient@email.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Describe Symptoms *</label>
                  <textarea
                    required
                    rows={3}
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                    placeholder="Describe what you are feeling..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-400 resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Attach Patient Lab Reports / Previous Records (PDF)
                  </label>
                  <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".pdf" className="hidden" />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                    className="w-full bg-slate-950 hover:bg-slate-800 text-slate-300 border border-dashed border-slate-700 hover:border-teal-500/50 py-3 rounded-lg text-xs transition flex items-center justify-center gap-2"
                  >
                    📎 {loading ? 'Uploading File...' : 'Upload PDF Medical Report'}
                  </button>

                  {uploadedDocs.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {uploadedDocs.map((doc) => (
                        <div key={doc.file_url} className="text-[11px] bg-teal-500/10 text-teal-300 border border-teal-500/20 px-2.5 py-1.5 rounded flex items-center justify-between">
                          <span className="truncate max-w-[200px]">📄 {doc.filename}</span>
                          <button
                            type="button"
                            onClick={() => setActivePdfUrl(doc.file_url)}
                            className="bg-teal-500/20 hover:bg-teal-500/40 text-teal-300 px-2 py-0.5 rounded text-[10px] transition"
                          >
                            👁️ View PDF
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-teal-500 hover:bg-teal-600 font-semibold py-2.5 rounded-lg text-slate-950 text-sm transition mt-4"
                >
                  {loading ? 'Processing...' : 'Submit Patient Registration'}
                </button>
              </form>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            <header className="border-b border-slate-800 pb-4 text-center">
              <h1 className="text-xl font-bold text-teal-400">Patient History Portal</h1>
              <p className="text-slate-400 text-xs mt-1">Search past visits, reports, and prescriptions</p>
            </header>

            <form onSubmit={handleSearchHistory} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Enter Registered Phone Number or Email
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. +1 555-0199 or patient@email.com"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-400"
                  />
                  <button
                    type="submit"
                    disabled={historyLoading}
                    className="bg-teal-500 hover:bg-teal-600 text-slate-950 font-semibold px-4 py-2 rounded-lg text-xs transition"
                  >
                    {historyLoading ? 'Searching...' : 'Find Records'}
                  </button>
                </div>
              </div>
            </form>

            <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
              {hasSearched && historyRecords.length === 0 && !historyLoading && (
                <div className="text-center py-8 bg-slate-950 rounded-xl border border-slate-800 text-slate-500 text-xs">
                  No records found for "{searchQuery}".
                </div>
              )}

              {historyRecords.map((item) => (
                <div key={item.session_id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-start border-b border-slate-800 pb-2">
                    <div>
                      <h3 className="font-bold text-sm text-teal-300">{item.patient_name}</h3>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Session: {item.session_id} • {new Date(item.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {item.appointment ? (
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
                        Prescription Issued
                      </span>
                    ) : (
                      <span className="text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-mono">
                        Check-in Recorded
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="text-[11px] font-semibold text-slate-400">Reported Symptoms:</p>
                    <p className="text-xs text-slate-300">{item.symptoms}</p>
                  </div>

                  {item.documents.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 mb-1">Submitted Medical Reports:</p>
                      <div className="flex flex-wrap gap-2">
                        {item.documents.map((doc) => (
                          <button
                            key={doc.file_url}
                            type="button"
                            onClick={() => setActivePdfUrl(doc.file_url)}
                            className="text-[11px] bg-slate-900 border border-slate-800 hover:border-teal-500 text-teal-300 px-2.5 py-1 rounded flex items-center gap-1 transition"
                          >
                            📄 {doc.filename}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {item.appointment && (
                    <div className="bg-slate-900 border border-teal-500/30 rounded-lg p-3 space-y-2 mt-2">
                      <div className="flex justify-between text-xs font-semibold text-teal-400">
                        <span>Appointment: {item.appointment.appointment_date} at {item.appointment.appointment_time}</span>
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-slate-400">Rx Medication Instructions:</p>
                        <p className="text-xs text-slate-200 whitespace-pre-line mt-0.5">{item.appointment.prescription_text}</p>
                      </div>
                      <a
                        href={item.appointment.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/30 px-3 py-1.5 rounded text-xs transition mt-1 font-semibold"
                      >
                        📄 Download Prescription PDF
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* PDF Viewer Modal */}
      {activePdfUrl && (
        <div 
          role="dialog" 
          aria-modal="true" 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4"
        >
          <div className="bg-slate-900 border border-slate-800 w-full max-w-4xl h-[85vh] rounded-xl flex flex-col overflow-hidden">
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
              <span className="text-xs font-semibold text-teal-400">PDF Document Preview</span>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setActivePdfUrl(null)}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800"
              >
                ✕ Close
              </button>
            </div>
            <iframe src={activePdfUrl} className="w-full h-full border-none" title="PDF Reader" />
          </div>
        </div>
      )}
    </main>
  );
}