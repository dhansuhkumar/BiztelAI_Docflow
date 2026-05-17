import { create } from 'zustand'
import { getDocuments, getDashboard } from '../utils/api'

export const useDocStore = create((set, get) => ({
  documents: [],
  total: 0,
  dashboard: null,
  loading: false,

  fetchDocuments: async (params) => {
    set({ loading: true })
    try {
      const { data } = await getDocuments(params)
      set({ documents: data.documents, total: data.total })
    } finally {
      set({ loading: false })
    }
  },

  fetchDashboard: async () => {
    try {
      const { data } = await getDashboard()
      set({ dashboard: data })
    } catch (err) {
      console.error('Failed to fetch dashboard:', err)
    }
  },
}))
