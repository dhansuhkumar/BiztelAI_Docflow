import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { getDocument, updateRecord, getPreviewUrl } from '../utils/api'

const FIELD_LABELS = {
  date: 'Date',
  shift: 'Shift',
  employee_number: 'Employee Number',
  operation_code: 'Operation Code',
  machine_number: 'Machine Number',
  work_order_number: 'Work Order Number',
  quantity_produced: 'Quantity Produced',
  time_taken_hours: 'Time Taken (hrs)',
  supervisor_name: 'Supervisor Name',
  remarks: 'Remarks',
}

const FIELD_ORDER = [
  'date', 'shift', 'employee_number', 'operation_code',
  'machine_number', 'work_order_number', 'quantity_produced',
  'time_taken_hours', 'supervisor_name', 'remarks'
]

function ConfBadge({ value }) {
  if (value == null) return null
  const pct = Math.round(value * 100)
  const cls = value >= 0.8 ? 'conf-high' : value >= 0.5 ? 'conf-medium' : 'conf-low'
  return <span className={`conf-badge ${cls}`}>{pct}%</span>
}

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>
}

export default function ReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [doc, setDoc] = useState(null)
  const [allRecords, setAllRecords] = useState([])
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [marking, setMarking] = useState(false)
  const [loading, setLoading] = useState(true)
  const pollRef = useRef(null)

  const buildForm = (rec) => ({
    date: rec.date || '',
    shift: rec.shift || '',
    employee_number: rec.employee_number || '',
    operation_code: rec.operation_code || '',
    machine_number: rec.machine_number || '',
    work_order_number: rec.work_order_number || '',
    quantity_produced: rec.quantity_produced ?? '',
    time_taken_hours: rec.time_taken_hours ?? '',
    supervisor_name: rec.supervisor_name || '',
    remarks: rec.remarks || '',
  })

  const load = async () => {
    try {
      const { data } = await getDocument(id)
      setDoc(data.document)
      const records = data.records || (data.record ? [data.record] : [])
      setAllRecords(records)
      if (records.length > 0 && !selectedRecord) {
        setSelectedRecord(records[0])
        setForm(buildForm(records[0]))
      } else if (records.length > 0 && selectedRecord) {
        const updated = records.find(r => r.id === selectedRecord.id)
        if (updated) {
          setSelectedRecord(updated)
          setForm(buildForm(updated))
        }
      }
    } catch (err) {
      toast.error('Failed to load document.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [id])

  const pollCountRef = useRef(0)
  const MAX_POLLS = 60 // ~3 minutes at 3s intervals

  useEffect(() => {
    if (doc?.status === 'processing' || doc?.status === 'uploaded') {
      pollCountRef.current = 0
      pollRef.current = setInterval(() => {
        pollCountRef.current += 1
        if (pollCountRef.current >= MAX_POLLS) {
          clearInterval(pollRef.current)
          setDoc(prev => prev ? { ...prev, status: 'failed', error_message: 'Extraction timed out. The AI service may be unavailable — please try re-uploading.' } : prev)
          return
        }
        load()
      }, 3000)
    } else {
      clearInterval(pollRef.current)
    }
    return () => clearInterval(pollRef.current)
  }, [doc?.status])

  const switchRecord = (rec) => {
    setSelectedRecord(rec)
    setForm(buildForm(rec))
  }

  const handleSave = async () => {
    if (!selectedRecord) return
    setSaving(true)
    try {
      const payload = {
        ...form,
        quantity_produced: form.quantity_produced !== '' ? Number(form.quantity_produced) : null,
        time_taken_hours: form.time_taken_hours !== '' ? Number(form.time_taken_hours) : null,
      }
      const { data } = await updateRecord(selectedRecord.id, payload)
      setSelectedRecord(data)
      setAllRecords(prev => prev.map(r => r.id === data.id ? data : r))
      toast.success('Record saved successfully!')
    } catch {
      toast.error('Failed to save changes.')
    } finally {
      setSaving(false)
    }
  }

  const handleMarkReviewed = async () => {
    if (!selectedRecord) return
    setMarking(true)
    try {
      const payload = {
        ...form,
        quantity_produced: form.quantity_produced !== '' ? Number(form.quantity_produced) : null,
        time_taken_hours: form.time_taken_hours !== '' ? Number(form.time_taken_hours) : null,
        mark_reviewed: true,
      }
      const { data } = await updateRecord(selectedRecord.id, payload)
      setSelectedRecord(data)
      setAllRecords(prev => prev.map(r => r.id === data.id ? data : r))
      await load()
      toast.success('Record marked as reviewed!')
    } catch {
      toast.error('Failed to mark as reviewed.')
    } finally {
      setMarking(false)
    }
  }

  const getFieldErrors = (field) => {
    if (!selectedRecord?.validation_errors) return []
    return selectedRecord.validation_errors.filter(e => e.field === field)
  }

  const errorFields = selectedRecord?.validation_errors?.filter(e => e.severity === 'error') || []
  const warningFields = selectedRecord?.validation_errors?.filter(e => e.severity === 'warning') || []

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(20,184,166,0.2)', borderTop: '3px solid #14b8a6', borderRadius: '50%' }} className="animate-spin" />
        <p style={{ color: '#64748b' }}>Loading document...</p>
      </div>
    )
  }

  if (!doc) return (
    <div style={{ textAlign: 'center', padding: '80px', color: '#475569' }}>
      <div style={{ fontSize: '48px', marginBottom: '16px' }}>?</div>
      <p>Document not found.</p>
    </div>
  )

  const isProcessing = doc.status === 'processing' || doc.status === 'uploaded'
  const allReviewed = allRecords.length > 0 && allRecords.every(r => r.is_reviewed)

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
        <button
          className="btn btn-secondary"
          style={{ padding: '7px 14px', fontSize: '13px' }}
          onClick={() => navigate('/documents')}
        >
          ← Back
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'white' }}>
              {doc.original_filename}
            </h1>
            <StatusBadge status={doc.status} />
          </div>
          <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
            {doc.file_size_kb?.toFixed(1)} KB . Uploaded {new Date(doc.upload_time).toLocaleString()}
          </p>
        </div>
        {allRecords.length > 1 && allReviewed && (
          <span className="badge badge-reviewed" style={{ padding: '8px 16px' }}>
            All rows reviewed
          </span>
        )}
      </div>

      {/* Processing state */}
      {isProcessing && (
        <div style={{
          background: 'rgba(245,158,11,0.1)',
          border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: '12px', padding: '20px',
          display: 'flex', alignItems: 'center', gap: '16px',
        }}>
          <div style={{ width: '32px', height: '32px', border: '3px solid rgba(245,158,11,0.3)', borderTop: '3px solid #fbbf24', borderRadius: '50%' }} className="animate-spin" />
          <div>
            <p style={{ fontWeight: 600, color: '#fbbf24', marginBottom: '4px' }}>AI Extraction in Progress</p>
            <p style={{ fontSize: '13px', color: '#92400e' }}>Analyzing your document. This usually takes 30-60 seconds...</p>
          </div>
        </div>
      )}

      {/* Failed state */}
      {doc.status === 'failed' && (
        <div style={{
          background: 'rgba(220,38,38,0.1)',
          border: '1px solid rgba(220,38,38,0.3)',
          borderRadius: '12px', padding: '20px',
        }}>
          <p style={{ fontWeight: 600, color: '#f87171', marginBottom: '6px' }}>Extraction Failed</p>
          <p style={{ fontSize: '13px', color: '#9f1239', fontFamily: 'monospace' }}>{doc.error_message}</p>
        </div>
      )}

      {/* Row selector */}
      {allRecords.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', color: '#94a3b8', alignSelf: 'center' }}>Rows extracted:</span>
          {allRecords.map((rec) => (
            <button
              key={rec.id}
              onClick={() => switchRecord(rec)}
              style={{
                padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 600, border: '1px solid',
                cursor: 'pointer',
                background: selectedRecord?.id === rec.id ? '#0d9488' : 'transparent',
                borderColor: selectedRecord?.id === rec.id ? '#14b8a6' : '#475569',
                color: selectedRecord?.id === rec.id ? 'white' : '#94a3b8',
              }}
            >
              Row {rec.row_number}
              {rec.has_validation_errors && (
                <span style={{ marginLeft: '4px', color: '#f87171' }}>!</span>
              )}
              {rec.is_reviewed && (
                <span style={{ marginLeft: '4px', color: '#4ade80' }}>OK</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Main content */}
      {selectedRecord && (
        <>
          {/* Confidence + validation summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="glass-card" style={{ padding: '20px' }}>
              <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Overall Confidence</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  fontSize: '36px', fontWeight: 800,
                  color: selectedRecord.overall_confidence >= 0.8 ? '#4ade80' : selectedRecord.overall_confidence >= 0.5 ? '#fbbf24' : '#f87171',
                }}>
                  {Math.round(selectedRecord.overall_confidence * 100)}%
                </div>
                <div style={{ flex: 1 }}>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{
                      width: `${selectedRecord.overall_confidence * 100}%`,
                      background: selectedRecord.overall_confidence >= 0.8 ? 'linear-gradient(90deg, #16a34a, #4ade80)' :
                        selectedRecord.overall_confidence >= 0.5 ? 'linear-gradient(90deg, #d97706, #fbbf24)' :
                          'linear-gradient(90deg, #dc2626, #f87171)',
                    }} />
                  </div>
                  <p style={{ fontSize: '12px', color: '#64748b', marginTop: '6px' }}>
                    Row {selectedRecord.row_number} weighted extraction confidence
                  </p>
                </div>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '20px' }}>
              <p style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Validation Status</p>
              {selectedRecord.validation_errors.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '28px' }}>V</span>
                  <p style={{ color: '#4ade80', fontWeight: 600 }}>All validations passed</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {errorFields.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>R</span>
                      <span style={{ color: '#f87171', fontWeight: 600 }}>{errorFields.length} error{errorFields.length !== 1 ? 's' : ''}</span>
                      <span style={{ color: '#64748b', fontSize: '13px' }}>must fix</span>
                    </div>
                  )}
                  {warningFields.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '18px' }}>Y</span>
                      <span style={{ color: '#fbbf24', fontWeight: 600 }}>{warningFields.length} warning{warningFields.length !== 1 ? 's' : ''}</span>
                      <span style={{ color: '#64748b', fontSize: '13px' }}>should review</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Side-by-side layout */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>
            {/* Document preview */}
            <div className="glass-card" style={{ padding: '16px', position: 'sticky', top: '80px' }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                Document Preview
              </p>
              {doc.file_type === 'image' ? (
                <img
                  src={getPreviewUrl(doc.id)}
                  alt="Document preview"
                  style={{
                    width: '100%', borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                />
              ) : (
                <iframe
                  src={getPreviewUrl(doc.id)}
                  title="PDF Preview"
                  style={{
                    width: '100%', height: '500px', border: 'none',
                    borderRadius: '8px', background: 'white',
                  }}
                />
              )}
              {selectedRecord.raw_extraction?.extraction_notes && (
                <div style={{
                  marginTop: '12px', padding: '12px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Notes</p>
                  <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
                    {selectedRecord.raw_extraction.extraction_notes}
                  </p>
                </div>
              )}
            </div>

            {/* Extracted data form */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {FIELD_ORDER.map(field => {
                const fieldErrors = getFieldErrors(field)
                const conf = selectedRecord.confidence_scores?.[field]
                const hasError = fieldErrors.some(e => e.severity === 'error')
                const hasWarning = fieldErrors.some(e => e.severity === 'warning')

                return (
                  <div key={field} className="glass-card" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: '#94a3b8' }}>
                        {FIELD_LABELS[field]}
                        {['date', 'shift', 'employee_number', 'work_order_number', 'quantity_produced'].includes(field) && (
                          <span style={{ color: '#f87171', marginLeft: '4px' }}>*</span>
                        )}
                      </label>
                      <ConfBadge value={conf} />
                    </div>

                    {field === 'shift' ? (
                      <select
                        className={`form-input ${hasError ? 'input-error' : hasWarning ? 'input-warning' : ''}`}
                        value={form[field] || ''}
                        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                        disabled={selectedRecord.is_reviewed}
                      >
                        <option value="">-- Select shift --</option>
                        <option value="Morning">Morning</option>
                        <option value="Afternoon">Afternoon</option>
                        <option value="Night">Night</option>
                      </select>
                    ) : field === 'remarks' ? (
                      <textarea
                        className={`form-input ${hasError ? 'input-error' : hasWarning ? 'input-warning' : ''}`}
                        value={form[field] || ''}
                        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                        rows={3}
                        disabled={selectedRecord.is_reviewed}
                        style={{ resize: 'vertical' }}
                      />
                    ) : (
                      <input
                        type={['quantity_produced', 'time_taken_hours'].includes(field) ? 'number' : 'text'}
                        className={`form-input ${hasError ? 'input-error' : hasWarning ? 'input-warning' : ''}`}
                        value={form[field] ?? ''}
                        onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                        placeholder={field === 'date' ? 'YYYY-MM-DD' : ''}
                        disabled={selectedRecord.is_reviewed}
                        step={field === 'time_taken_hours' ? '0.25' : undefined}
                        min={field === 'quantity_produced' ? '0' : undefined}
                      />
                    )}

                    {fieldErrors.map((err, i) => (
                      <div key={i} style={{
                        marginTop: '6px', display: 'flex', alignItems: 'flex-start', gap: '6px',
                        padding: '6px 10px',
                        background: err.severity === 'error' ? 'rgba(220,38,38,0.08)' : 'rgba(217,119,6,0.08)',
                        borderRadius: '6px',
                        border: `1px solid ${err.severity === 'error' ? 'rgba(220,38,38,0.2)' : 'rgba(217,119,6,0.2)'}`,
                      }}>
                        <span style={{ fontSize: '13px' }}>{err.severity === 'error' ? 'R' : 'Y'}</span>
                        <p style={{ fontSize: '12px', color: err.severity === 'error' ? '#fca5a5' : '#fcd34d', lineHeight: 1.4 }}>
                          {err.message}
                        </p>
                      </div>
                    ))}
                  </div>
                )
              })}

              {/* Save buttons */}
              {!selectedRecord.is_reviewed && (
                <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={handleMarkReviewed}
                    disabled={marking}
                  >
                    {marking ? 'Marking...' : 'Save & Mark Reviewed'}
                  </button>
                </div>
              )}

              {selectedRecord.is_reviewed && (
                <div style={{
                  padding: '12px', borderRadius: '8px',
                  background: 'rgba(74,222,128,0.08)',
                  border: '1px solid rgba(74,222,128,0.2)',
                  textAlign: 'center',
                }}>
                  <span style={{ color: '#4ade80', fontWeight: 600 }}>
                    Row {selectedRecord.row_number} reviewed {selectedRecord.reviewed_at ? `- ${new Date(selectedRecord.reviewed_at).toLocaleDateString()}` : ''}
                  </span>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
