import { createClient } from '@supabase/supabase-js'

// Only the columns the pitch reads (village-tuktuks-ads-main/src/types).

export interface Ad {
  id: string
  title: string
  is_active: boolean
}

export interface Tuktuk {
  id: number
  active: boolean
  last_seen_at: string | null
}

export interface SalesPackage {
  id: string
  name: string
  description: string | null
  monthly_fee: number | null
  areas: string[]
  features: string[]
  sort_order: number
  active: boolean
  created_at: string
}

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/** True once VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY have been filled in. */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient(url || 'https://placeholder.supabase.co', anonKey || 'placeholder-anon-key')

export async function listPackages(): Promise<SalesPackage[]> {
  if (!isSupabaseConfigured) return []
  const { data, error } = await supabase
    .from('sales_packages')
    .select('*')
    .eq('active', true)
    .order('sort_order')
    .order('created_at')
  if (error) throw error
  return (data as SalesPackage[]) ?? []
}
