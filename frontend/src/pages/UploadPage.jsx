import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { uploadDocument, getDocuments } from '../utils/api'

const MAX_SIZE_MB = 20

function StatusDot({ status }) {
  const colors = {
    uploaded: '#94a3b8',
    processing: '#fbbf24',
    extracted: '#4ade80',
    reviewed: '#60a5fa',
    failed: '#f87171',
  }
  const labels = {
    uploaded: 'Uploaded',
    processing: 'Processing…',
    extracted: 'Extracted',
    reviewed: 'Reviewed',
    failed: 'Failed',
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: colors[status] || '#94a3b8' }}>
      <span style={{
        width: '7px', height: '7px', borderRadius: '50%',
        background: colors[status] || '#94a3b8',
        boxShadow: status === 'processing' ? `0 0 6px ${colors[status]}` : 'none',
      }} />
      {labels[status] || status}
    </span>
  )
}

export default function UploadPage() {
  const navigate = useNavigate()
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState({})
  const [recentDocs, setRecentDocs] = useState([])

  const loadRecent = async () => {
    try {
      const { data } = await getDocuments({ limit: 5 })
      setRecentDocs(data.documents)
    } catch {}
  }

  useEffect(() => {
    loadRecent()
  }, [])

  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length > 0) {
      toast.error('Some files were rejected. Only JPG, PNG, PDF, WebP allowed (max 20MB).')
    }
    const valid = accepted.filter(f => f.size <= MAX_SIZE_MB * 1024 * 1024)
    if (valid.length < accepted.length) {
      toast.error('Some files exceed 20MB and were skipped.')
    }
    setFiles(prev => [...prev, ...valid.map(f => ({ file: f, id: Math.random().toString(36).slice(2) }))])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/webp': ['.webp'],
      'application/pdf': ['.pdf'],
    },
    maxSize: MAX_SIZE_MB * 1024 * 1024,
    multiple: true,
  })

  const removeFile = (id) => setFiles(prev => prev.filter(f => f.id !== id))

  const handleUpload = async () => {
    if (files.length === 0) return
    setUploading(true)
    const results = []

    for (const item of files) {
      try {
        const { data } = await uploadDocument(item.file, (pct) => {
          setProgress(prev => ({ ...prev, [item.id]: pct }))
        })
        results.push({ success: true, name: item.file.name, docId: data.document_id })
        toast.success(`✅ ${item.file.name} uploaded! Processing…`)
      } catch (err) {
        results.push({ success: false, name: item.file.name })
        toast.error(`❌ Failed to upload ${item.file.name}`)
      }
    }

    setFiles([])
    setProgress({})
    setUploading(false)
    await loadRecent()

    if (results.length === 1 && results[0].success) {
      setTimeout(() => navigate(`/documents/${results[0].docId}/review`), 800)
    }
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const FileIcon = ({ type }) => {
    if (type === 'application/pdf') return <span style={{ fontSize: '32px' }}>📄</span>
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '800px', margin: '0 auto' }} className="animate-fade-in">
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
          Upload Manufacturing Documents
        </h1>
        <p style={{ color: '#64748b', fontSize: '15px' }}>
          Upload handwritten or printed manufacturing records — AI will extract and structure the data automatically.
        </p>
      </div>

      {/* Drop zone */}
      <div
        {...getRootProps()}
        style={{
          border: `2px dashed ${isDragActive ? '#14b8a6' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: '16px',
          padding: '48px 32px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.25s',
          background: isDragActive ? 'rgba(20,184,166,0.06)' : 'rgba(22,33,48,0.5)',
          transform: isDragActive ? 'scale(1.01)' : 'scale(1)',
        }}
      >
        <input {...getInputProps()} />
        <div style={{ fontSize: '52px', marginBottom: '16px' }}>
          {isDragActive ? '📥' : '☁️'}
        </div>
        <p style={{ fontSize: '18px', fontWeight: 600, color: 'white', marginBottom: '8px' }}>
          {isDragActive ? 'Drop files here!' : 'Drag & drop files here'}
        </p>
        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '16px' }}>
          or click to browse — JPG, PNG, PDF, WebP (max 20MB each)
        </p>
        <span className="btn btn-secondary" style={{ pointerEvents: 'none', display: 'inline-flex' }}>
          📁 Browse Files
        </span>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '13px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Ready to upload ({files.length} {files.length === 1 ? 'file' : 'files'})
          </p>
          {files.map(({ file, id }) => (
            <div key={id} style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 16px',
              background: 'rgba(255,255,255,0.03)',
              borderRadius: '10px',
              border: '1px solid rgba(255,255,255,0.06)',
            }}>
              {file.type.startsWith('image/') ? (
                <img
                  src={URL.createObjectURL(file)}
                  alt={file.name}
                  style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '6px', flexShrink: 0 }}
                />
              ) : (
                <div style={{
                  width: '48px', height: '48px',
                  background: 'rgba(220,38,38,0.15)',
                  borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '24px', flexShrink: 0
                }}>📄</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '14px', fontWeight: 500, color: 'white', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </p>
                <p style={{ fontSize: '12px', color: '#64748b' }}>{formatSize(file.size)}</p>
                {progress[id] !== undefined && (
                  <div className="progress-bar" style={{ marginTop: '6px' }}>
                    <div className="progress-fill" style={{ width: `${progress[id]}%` }} />
                  </div>
                )}
              </div>
              <button
                onClick={() => removeFile(id)}
                style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '18px', padding: '4px', lineHeight: 1 }}
                title="Remove"
              >×</button>
            </div>
          ))}

          <button
            className="btn btn-primary"
            onClick={handleUpload}
            disabled={uploading}
            style={{ alignSelf: 'flex-end', marginTop: '4px' }}
          >
            {uploading ? (
              <>
                <span className="animate-spin" style={{ display: 'inline-block', fontSize: '14px' }}>⟳</span>
                Uploading…
              </>
            ) : (
              <>🚀 Upload {files.length} {files.length === 1 ? 'File' : 'Files'}</>
            )}
          </button>
        </div>
      )}

      {/* Recent uploads */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'white' }}>Recent Uploads</h2>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '13px' }}
            onClick={() => navigate('/documents')}
          >
            View all →
          </button>
        </div>

        {recentDocs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: '#475569' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>📭</div>
            <p>No documents uploaded yet. Start by uploading a manufacturing record above.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentDocs.map(doc => (
              <div
                key={doc.id}
                onClick={() => navigate(`/documents/${doc.id}/review`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.05)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(20,184,166,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              >
                <span style={{ fontSize: '20px' }}>{doc.file_type === 'pdf' ? '📄' : '🖼️'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '14px', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.original_filename}
                  </p>
                  <p style={{ fontSize: '12px', color: '#475569' }}>
                    {doc.file_size_kb?.toFixed(1)} KB · {new Date(doc.upload_time).toLocaleString()}
                  </p>
                </div>
                <StatusDot status={doc.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {[
          { icon: '🤖', title: 'AI Extraction', desc: 'Claude Vision AI reads handwritten text and extracts structured fields' },
          { icon: '✅', title: 'Auto Validation', desc: 'Business rules check for missing fields, invalid dates, and anomalies' },
          { icon: '📊', title: 'Analytics Ready', desc: 'Dashboard shows shift breakdowns, machine stats, and production totals' },
        ].map(({ icon, title, desc }) => (
          <div key={title} className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>{icon}</div>
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'white', marginBottom: '6px' }}>{title}</p>
            <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
