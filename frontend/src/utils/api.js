import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 60000,
})

export const uploadDocument = (file, onProgress) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/upload', form, {
    onUploadProgress: e => onProgress?.(Math.round((e.loaded * 100) / e.total))
  })
}

export const getDocuments = (params = {}) => api.get('/documents', { params })
export const getDocument = (id) => api.get(`/documents/${id}`)
export const updateRecord = (id, data) => api.patch(`/records/${id}`, data)
export const getDashboard = () => api.get('/dashboard')
export const getPreviewUrl = (id) => `${api.defaults.baseURL}/documents/${id}/preview`

export default api
