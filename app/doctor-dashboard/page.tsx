'use client';

import { useState, useEffect } from 'react';

interface PatientRecord {
  session_id: string;
  created_at: string;
  patient_name: string;
  contact_number: string;
  contact_email: string;
  symptoms: string;
  documents_count: number;
  documents: Array<{
    filename: string;
    file_url: string;
    extracted_text: string;
  }>;
  appointment?: {
    appointment_date: string;
    appointment_time: string;
    doctor_notes: string;
    prescription_text: string;
    pdf_url: string;
  };
}

export default function DoctorDashboard() {
  const [records, setRecords] = useState<PatientRecord[]>([]);
  const [selected, setSelected] = useState<PatientRecord | null>(null);
  
  // Appointment form inputs
  const [apptDate, setApptDate] = useState('');
  const [apptTime, setApptTime] = useState('');
  const [doctorNotes, setDoctorNotes] = useState('');
  const [prescription, setPrescription] = useState('');
  const [issuing, setIssuing] = useState(false);

  // PDF Preview Modal State
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);

  // Handle ESC key and scroll lock during PDF preview modal
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

  useEffect(() => {
    const fetchRecords = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/v1/intake/sessions');
        if (res.ok) {
          const data = await res.json();
          setRecords(data.intakes || []);
        }
      } catch (err) {
        console.error(err);
      }
    };

    fetchRecords();
    const interval = setInterval(fetchRecords, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleIssueAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    setIssuing(true);
    try {
      const res = await fetch('http://127.0.0.1:8000/api/v1/doctor/issue-appointment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: selected.session_id,
          appointment_date: apptDate,
          appointment_time: apptTime,
          doctor_notes: doctorNotes,
          prescription_text: prescription,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSelected((prev) => prev ? { ...prev, appointment: data.appointment } : null);
        alert('Appointment & Prescription PDF Issued Successfully!');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIssuing(false);
    }
  };
  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-teal-400">Clinical Triage Portal</h1>
            <p className="text-slate-400 text-xs">Issue Appointments & PDF Prescriptions</p>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Queue */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-3">Queue ({records.length})</h2>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {records.map((item) => (
                <div
                  key={item.session_id}
                  onClick={() => {
                    setSelected(item);
                    if (item.appointment) {
                      setApptDate(item.appointment.appointment_date);
                      setApptTime(item.appointment.appointment_time);
                      setDoctorNotes(item.appointment.doctor_notes);
                      setPrescription(item.appointment.prescription_text);
                    } else {
                      setApptDate('');
                      setApptTime('');
                      setDoctorNotes('');
                      setPrescription('');
                    }
                  }}
                  className={`p-3 rounded-lg border cursor-pointer transition ${
                    selected?.session_id === item.session_id
                      ? 'bg-teal-950 border-teal-500'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700'
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-sm text-teal-300">{item.patient_name}</span>
                    {item.appointment ? (
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded">
                        ✓ Scheduled
                      </span>
                    ) : (
                      <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded">
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{item.symptoms}</p>
                  {item.documents && item.documents.length > 0 && (
                    <p className="text-[10px] text-teal-400 mt-1 font-mono">
                      📎 {item.documents.length} PDF report(s) attached
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action Center */}
          <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6">
            {selected ? (
              <div className="space-y-6">
                <div className="border-b border-slate-800 pb-4 flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-bold text-white">{selected.patient_name}</h2>
                    <p className="text-xs text-slate-400 mt-1">Symptoms: {selected.symptoms}</p>
                  </div>
                  <div className="text-right text-xs text-slate-400">
                    <p>📞 {selected.contact_number}</p>
                    <p>✉️ {selected.contact_email}</p>
                  </div>
                </div>

                {/* Patient Documents Section */}
                <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-3">
                  <h3 className="text-xs font-semibold text-teal-400 uppercase tracking-wider">
                    Uploaded Medical Reports ({selected.documents?.length || 0})
                  </h3>

                  {selected.documents && selected.documents.length > 0 ? (
                    <div className="space-y-2">
                      {selected.documents.map((doc) => (
                        <div
                          key={doc.file_url}
                          className="flex justify-between items-center bg-slate-900 border border-slate-800 p-2.5 rounded text-xs"
                        >
                          <div className="truncate max-w-[320px]">
                            <p className="font-semibold text-slate-200 truncate">📄 {doc.filename}</p>
                            {doc.extracted_text && (
                              <p className="text-[10px] text-slate-500 truncate mt-0.5">
                                Preview: {doc.extracted_text}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setActivePdfUrl(doc.file_url)}
                            className="bg-teal-500/20 hover:bg-teal-500/40 text-teal-300 border border-teal-500/30 px-3 py-1 rounded text-xs transition font-semibold"
                          >
                            👁️ View Document
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 italic">No medical reports uploaded by this patient.</p>
                  )}
                </div>

                {/* Appointment & Prescription Form */}
                <form onSubmit={handleIssueAppointment} className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-4">
                  <h3 className="text-xs font-semibold text-teal-400 uppercase tracking-wider">
                    Issue Appointment Letter & Prescription
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Appointment Date *</label>
                      <input
                        type="date"
                        required
                        value={apptDate}
                        onChange={(e) => setApptDate(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Appointment Time *</label>
                      <input
                        type="time"
                        required
                        value={apptTime}
                        onChange={(e) => setApptTime(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Doctor's Triage Notes</label>
                    <textarea
                      rows={2}
                      value={doctorNotes}
                      onChange={(e) => setDoctorNotes(e.target.value)}
                      placeholder="e.g. Patient exhibits mild viral symptoms. Rest advised."
                      className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-white resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Rx - Immediate Prescription Medications</label>
                    <textarea
                      rows={3}
                      required
                      value={prescription}
                      onChange={(e) => setPrescription(e.target.value)}
                      placeholder="1. Paracetamol 500mg - Take 1 tablet every 8 hours after meals&#10;2. ORS Hydration Pack - 1 sachet daily"
                      className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-xs text-white resize-none"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      disabled={issuing}
                      className="bg-teal-500 hover:bg-teal-600 text-slate-950 font-semibold px-4 py-2 rounded text-xs transition"
                    >
                      {issuing ? 'Generating Prescription...' : 'Issue Appointment & Generate PDF'}
                    </button>

                    {selected.appointment?.pdf_url && (
                      <a
                        href={selected.appointment.pdf_url}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-2 rounded text-xs transition flex items-center gap-1"
                      >
                        📄 Download Generated PDF
                      </a>
                    )}
                  </div>
                </form>
              </div>
            ) : (
              <div className="text-center py-20 text-slate-500 text-xs">
                Select a patient from the queue to issue an appointment or prescription.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Doctor PDF Document Modal */}
      {activePdfUrl && (
        <div 
          role="dialog" 
          aria-modal="true" 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4"
        >
          <div className="bg-slate-900 border border-slate-800 w-full max-w-5xl h-[88vh] rounded-xl flex flex-col overflow-hidden shadow-2xl">
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
              <span className="text-xs font-semibold text-teal-400">Patient PDF Document Viewer</span>
              <button
                type="button"
                aria-label="Close modal"
                onClick={() => setActivePdfUrl(null)}
                className="text-xs text-slate-400 hover:text-white px-3 py-1 rounded bg-slate-800 transition"
              >
                ✕ Close Preview
              </button>
            </div>
            <iframe src={activePdfUrl} className="w-full h-full border-none" title="Doctor PDF Reader" />
          </div>
        </div>
      )}
    </main>
  );
}