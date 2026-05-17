import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDocStore } from '../store/useDocStore'

const STATUS_OPTIONS = ['', 'uploaded', 'processing', 'extracted', 'reviewed', 'failed']

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{
    status === 'processing' ? (
      <span className="animate-spin" style={{ display: 'inline-block', fontSize: '10px' }}>⟳</span>
    ) : null
  } {status}</span>
}

function ConfidenceBar({ value }) {
  if (value == null) return <span style={{ color: '#475569', fontSize: '13px' }}>—</span>
  const pct = Math.round(value * 100)
  const color = value >= 0.8 ? '#4ade80' : value >= 0.5 ? '#fbbf24' : '#f87171'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.08)', borderRadius: '3px', minWidth: '60px' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: '12px', color, fontWeight: 600, minWidth: '32px' }}>{pct}%</span>
    </div>
  )
}

export default function DocumentsPage() {
  const navigate = useNavigate()
  const { documents, total, loading, fetchDocuments } = useDocStore()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(0)
  const limit = 20
  const pollRef = useRef(null)
  const [recordMap, setRecordMap] = useState({})

  const load = (s = search, st = status, pg = page) => {
    const params = { skip: pg * limit, limit }
    if (s) params.search = s
    if (st) params.status = st
    fetchDocuments(params)
  }

  useEffect(() => {
    load()
  }, [page])

  useEffect(() => {
    setPage(0)
    load(search, status, 0)
  }, [search, status])

  // Auto-refresh for processing docs
  useEffect(() => {
    const hasProcessing = documents.some(d => d.status === 'processing' || d.status === 'uploaded')
    if (hasProcessing) {
      pollRef.current = setInterval(() => load(), 5000)
    } else {
      clearInterval(pollRef.current)
    }
    return () => clearInterval(pollRef.current)
  }, [documents])

  const totalPages = Math.ceil(total / limit)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="animate-fade-in">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'white', marginBottom: '6px' }}>
            Documents
          </h1>
          <p style={{ color: '#64748b', fontSize: '14px' }}>
            {total} total document{total !== 1 ? 's' : ''} · Click a row to review extracted data
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/')}
        >
          + Upload New
        </button>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: '16px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px', position: 'relative' }}>
          <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }}>🔍</span>
          <input
            className="form-input"
            style={{ paddingLeft: '36px' }}
            placeholder="Search by filename…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="form-input"
          style={{ width: '180px' }}
          value={status}
          onChange={e => setStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map(s => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
        <button
          className="btn btn-secondary"
          style={{ padding: '9px 14px', fontSize: '13px' }}
          onClick={() => { setSearch(''); setStatus(''); }}
        >
          Clear
        </button>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Size</th>
                <th>Uploaded</th>
                <th>Status</th>
                <th>Confidence</th>
                <th>Errors</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && documents.length === 0 ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j}><div className="skeleton" style={{ height: '16px', width: j === 0 ? '180px' : '80px' }} /></td>
                    ))}
                  </tr>
                ))
              ) : documents.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: '#475569' }}>
                    <div style={{ fontSize: '36px', marginBottom: '12px' }}>📭</div>
                    No documents found. Upload your first manufacturing record!
                  </td>
                </tr>
              ) : (
                documents.map(doc => (
                  <tr
                    key={doc.id}
                    onClick={() => navigate(`/documents/${doc.id}/review`)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '18px' }}>{doc.file_type === 'pdf' ? '📄' : '🖼️'}</span>
                        <div>
                          <p style={{ fontSize: '14px', color: 'white', fontWeight: 500, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.original_filename}
                          </p>
                          <p style={{ fontSize: '11px', color: '#475569' }}>ID #{doc.id}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {doc.file_type}
                      </span>
                    </td>
                    <td style={{ color: '#64748b', fontSize: '13px' }}>{doc.file_size_kb?.toFixed(1)} KB</td>
                    <td style={{ color: '#64748b', fontSize: '13px', whiteSpace: 'nowrap' }}>
                      {new Date(doc.upload_time).toLocaleDateString()}<br/>
                      <span style={{ fontSize: '11px', color: '#374151' }}>
                        {new Date(doc.upload_time).toLocaleTimeString()}
                      </span>
                    </td>
                    <td><StatusBadge status={doc.status} /></td>
                    <td style={{ minWidth: '120px' }}>
                      {doc.status === 'extracted' || doc.status === 'reviewed' ? (
                        <ConfidenceBar value={null} />
                      ) : <span style={{ color: '#374151', fontSize: '13px' }}>—</span>}
                    </td>
                    <td>
                      {doc.status === 'failed' ? (
                        <span style={{ fontSize: '12px', color: '#f87171' }} title={doc.error_message}>⚠ Error</span>
                      ) : <span style={{ color: '#374151', fontSize: '13px' }}>—</span>}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '5px 12px', fontSize: '12px' }}
                        onClick={() => navigate(`/documents/${doc.id}/review`)}
                      >
                        Review →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px',
            borderTop: '1px solid rgba(255,255,255,0.05)',
          }}>
            <span style={{ fontSize: '13px', color: '#64748b' }}>
              Page {page + 1} of {totalPages} · {total} records
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 14px', fontSize: '13px' }}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                ← Prev
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 14px', fontSize: '13px' }}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
