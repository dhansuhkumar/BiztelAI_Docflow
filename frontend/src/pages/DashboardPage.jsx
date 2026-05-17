import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import { useDocStore } from '../store/useDocStore'

const COLORS = {
  Morning: '#14b8a6',
  Afternoon: '#f59e0b',
  Night: '#8b5cf6',
  Unknown: '#64748b',
}

const STATUS_COLORS = {
  uploaded: '#64748b',
  processing: '#f59e0b',
  extracted: '#22c55e',
  reviewed: '#3b82f6',
  failed: '#ef4444',
}

const PIE_COLORS = Object.values(STATUS_COLORS)

function StatCard({ icon, label, value, sub, color = '#14b8a6' }) {
  return (
    <div className="glass-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', top: '-10px', right: '-10px',
        width: '80px', height: '80px', borderRadius: '50%',
        background: `${color}18`, border: `1px solid ${color}22`,
      }} />
      <div style={{ fontSize: '28px', marginBottom: '12px' }}>{icon}</div>
      <div style={{ fontSize: '32px', fontWeight: 800, color: 'white', marginBottom: '4px', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 500, color: '#94a3b8', marginBottom: '4px' }}>{label}</div>
      {sub && <div style={{ fontSize: '12px', color: '#475569' }}>{sub}</div>}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: color, opacity: 0.6 }} />
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#1e2f42', border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#e2e8f0',
    }}>
      <p style={{ fontWeight: 600, marginBottom: '4px' }}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: {p.value?.toLocaleString()}</p>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const { dashboard, fetchDashboard } = useDocStore()
  const navigate = useNavigate()

  useEffect(() => {
    fetchDashboard()
  }, [])

  if (!dashboard) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '400px', flexDirection: 'column', gap: '16px' }}>
        <div style={{ width: '40px', height: '40px', border: '3px solid rgba(20,184,166,0.2)', borderTop: '3px solid #14b8a6', borderRadius: '50%' }} className="animate-spin" />
        <p style={{ color: '#64748b' }}>Loading analytics…</p>
      </div>
    )
  }

  const { summary, shift_breakdown, top_machines, status_breakdown, recent_uploads } = dashboard

  // Prepare shift chart data (ensure all 3 shifts present)
  const shiftData = ['Morning', 'Afternoon', 'Night'].map(s => {
    const found = shift_breakdown.find(x => x.shift === s) || {}
    return { shift: s, total_quantity: found.total_quantity || 0, count: found.count || 0 }
  }).concat(
    shift_breakdown.filter(x => !['Morning', 'Afternoon', 'Night'].includes(x.shift))
  )

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
          Analytics Dashboard
        </h1>
        <p style={{ color: '#64748b', fontSize: '14px' }}>
          Real-time production metrics from extracted manufacturing records
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <StatCard
          icon="📤"
          label="Total Uploads"
          value={summary.total_uploads}
          sub={`${summary.total_extracted} extracted · ${summary.total_failed} failed`}
          color="#14b8a6"
        />
        <StatCard
          icon="⚠️"
          label="Extraction Failures"
          value={summary.total_failed}
          sub="Documents that failed AI extraction"
          color="#ef4444"
        />
        <StatCard
          icon="🔴"
          label="Validation Failures"
          value={summary.validation_failures}
          sub="Records with critical errors"
          color="#f59e0b"
        />
        <StatCard
          icon="🎯"
          label="Avg Confidence"
          value={`${Math.round(summary.average_confidence * 100)}%`}
          sub={`${summary.reviewed_records} records reviewed`}
          color="#8b5cf6"
        />
      </div>

      {/* Charts row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px' }}>
        {/* Shift breakdown chart */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'white', marginBottom: '20px' }}>
            📊 Production by Shift
          </h2>
          {shiftData.length === 0 || shiftData.every(d => d.total_quantity === 0) ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>📊</div>
              <p>No production data yet</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={shiftData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="shift" tick={{ fill: '#64748b', fontSize: 13 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total_quantity" name="Total Quantity" radius={[6, 6, 0, 0]}>
                  {shiftData.map((entry, i) => (
                    <Cell key={i} fill={COLORS[entry.shift] || '#14b8a6'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status breakdown pie */}
        <div className="glass-card" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'white', marginBottom: '20px' }}>
            🍩 Status Breakdown
          </h2>
          {status_breakdown.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>
              <div style={{ fontSize: '36px', marginBottom: '12px' }}>📭</div>
              <p>No data</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={status_breakdown}
                  dataKey="count"
                  nameKey="status"
                  cx="50%" cy="45%"
                  innerRadius={55} outerRadius={90}
                  paddingAngle={3}
                >
                  {status_breakdown.map((entry, i) => (
                    <Cell key={i} fill={STATUS_COLORS[entry.status] || PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(val) => <span style={{ color: '#94a3b8', fontSize: '12px' }}>{val}</span>}
                  iconSize={10}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top machines chart */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'white', marginBottom: '20px' }}>
          🏭 Top Machines by Production Volume
        </h2>
        {top_machines.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#475569' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🏭</div>
            <p>No machine data yet. Upload production records to see machine-level analytics.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={top_machines} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#64748b', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="machine" tick={{ fill: '#94a3b8', fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="total_quantity" name="Total Quantity" fill="#14b8a6" radius={[0, 6, 6, 0]} background={{ fill: 'rgba(255,255,255,0.02)', radius: [0, 6, 6, 0] }} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Recent uploads */}
      <div className="glass-card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'white' }}>🕐 Recent Uploads</h2>
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '13px' }}
            onClick={() => navigate('/documents')}
          >
            View all →
          </button>
        </div>
        {!recent_uploads || recent_uploads.length === 0 ? (
          <p style={{ color: '#475569', textAlign: 'center', padding: '24px' }}>No uploads yet</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Document</th>
                <th>Type</th>
                <th>Uploaded</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recent_uploads.map(doc => (
                <tr key={doc.id} onClick={() => navigate(`/documents/${doc.id}/review`)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{doc.file_type === 'pdf' ? '📄' : '🖼️'}</span>
                      <span style={{ color: '#e2e8f0', fontSize: '14px' }}>{doc.original_filename}</span>
                    </div>
                  </td>
                  <td style={{ color: '#64748b', fontSize: '13px', textTransform: 'uppercase' }}>{doc.file_type}</td>
                  <td style={{ color: '#64748b', fontSize: '13px' }}>
                    {new Date(doc.upload_time).toLocaleString()}
                  </td>
                  <td><span className={`badge badge-${doc.status}`}>{doc.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary totals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#14b8a6', marginBottom: '6px' }}>
            {summary.total_quantity_produced.toLocaleString()}
          </div>
          <div style={{ fontSize: '14px', color: '#64748b' }}>Total Units Produced</div>
        </div>
        <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#3b82f6', marginBottom: '6px' }}>
            {summary.reviewed_records}
          </div>
          <div style={{ fontSize: '14px', color: '#64748b' }}>Records Reviewed</div>
        </div>
        <div className="glass-card" style={{ padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#a78bfa', marginBottom: '6px' }}>
            {summary.total_records}
          </div>
          <div style={{ fontSize: '14px', color: '#64748b' }}>Total Records</div>
        </div>
      </div>
    </div>
  )
}
