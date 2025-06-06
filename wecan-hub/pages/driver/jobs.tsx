import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast, ToastContainer } from 'react-toastify'
import { useUser } from '../../src/hooks/useUser'
import { supabase } from '../../src/lib/supabaseClient'
import 'react-toastify/dist/ReactToastify.css'

interface Pickup {
  id: string
  bin_id: string
  volunteer_id: string | null
  state: 'queued' | 'assigned' | 'collected' | 'delivered'
  created_at: string
  updated_at: string
}

interface Bin {
  id: string
  partner_id: string
  lat: number
  lng: number
  status: 'empty' | 'full' | 'needs_pickup'
  Partner?: {
    id: string
    name: string
    address: string
  }
}

interface Impact {
  cans: number
  revenue_pence: number
  meals: number
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export default function DriverJobs() {
  const { user, loading } = useUser()
  const queryClient = useQueryClient()

  // Fetch available jobs (queued pickups)
  const { data: availableJobs = [] } = useQuery({
    queryKey: ['availableJobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Pickup')
        .select(`
          *,
          Bin (
            id,
            partner_id,
            lat,
            lng,
            status,
            Partner (
              id,
              name,
              address
            )
          )
        `)
        .eq('state', 'queued')
        .order('created_at', { ascending: true })
      
      if (error) throw error
      return data as (Pickup & { Bin: Bin })[]
    },
    enabled: !!user
  })

  // Fetch my jobs (assigned to current user)
  const { data: myJobs = [] } = useQuery({
    queryKey: ['myJobs'],
    queryFn: async () => {
      if (!user?.id) return []
      
      const { data, error } = await supabase
        .from('Pickup')
        .select(`
          *,
          Bin (
            id,
            partner_id,
            lat,
            lng,
            status,
            Partner (
              id,
              name,
              address
            )
          )
        `)
        .eq('volunteer_id', user.id)
        .in('state', ['assigned', 'collected'])
        .order('created_at', { ascending: true })
      
      if (error) throw error
      return data as (Pickup & { Bin: Bin })[]
    },
    enabled: !!user
  })

  // Accept job mutation
  const acceptJob = useMutation({
    mutationFn: async (pickupId: string) => {
      if (!user?.id) throw new Error('User not authenticated')
      
      const { error } = await supabase
        .from('Pickup')
        .update({
          state: 'assigned',
          volunteer_id: user.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', pickupId)
        .eq('state', 'queued') // Only update if still queued
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['availableJobs'] })
      queryClient.invalidateQueries({ queryKey: ['myJobs'] })
      toast.success('Job accepted successfully!')
    },
    onError: (error) => {
      toast.error('Failed to accept job. It may have been taken by another driver.')
      console.error(error)
    }
  })

  // Mark collected mutation
  const markCollected = useMutation({
    mutationFn: async (pickupId: string) => {
      const { error } = await supabase
        .from('Pickup')
        .update({
          state: 'collected',
          updated_at: new Date().toISOString()
        })
        .eq('id', pickupId)
        .eq('state', 'assigned')
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myJobs'] })
      toast.success('Marked as collected!')
    },
    onError: (error) => {
      toast.error('Failed to mark as collected')
      console.error(error)
    }
  })

  // Mark delivered mutation
  const markDelivered = useMutation({
    mutationFn: async (pickupId: string) => {
      // First update the pickup state
      const { error: pickupError } = await supabase
        .from('Pickup')
        .update({
          state: 'delivered',
          updated_at: new Date().toISOString()
        })
        .eq('id', pickupId)
        .eq('state', 'collected')
      
      if (pickupError) throw pickupError

      // Then insert impact record
      const { error: impactError } = await supabase
        .from('Impact')
        .insert({
          cans: 200,
          revenue_pence: 160,
          meals: 10
        })
      
      if (impactError) throw impactError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myJobs'] })
      toast.success('Delivery completed! Impact recorded.')
    },
    onError: (error) => {
      toast.error('Failed to mark as delivered')
      console.error(error)
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-6">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Please log in</h1>
          <p className="text-gray-600">You need to be logged in to access the driver job board.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">Driver Job Board</h1>
          <p className="text-sm text-gray-600 mt-1">Find and manage pickup jobs</p>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* My Active Jobs */}
        {myJobs.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">My Active Jobs</h2>
            <div className="space-y-3">
              {myJobs.map((job) => (
                <div key={job.id} className="bg-white rounded-lg shadow p-4 border border-gray-200">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {job.Bin?.Partner?.name || 'Unknown Partner'}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {job.Bin?.Partner?.address || 'Address not available'}
                      </p>
                    </div>
                    <span className={classNames(
                      'px-2 py-1 text-xs font-medium rounded-full',
                      job.state === 'assigned' ? 'bg-blue-100 text-blue-800' :
                      'bg-yellow-100 text-yellow-800'
                    )}>
                      {job.state}
                    </span>
                  </div>
                  
                  <div className="text-xs text-gray-500 mb-3">
                    <p>Bin ID: {job.bin_id.substring(0, 8)}...</p>
                    <p>Location: {job.Bin?.lat.toFixed(4)}, {job.Bin?.lng.toFixed(4)}</p>
                    <p>Accepted: {new Date(job.updated_at).toLocaleString()}</p>
                  </div>

                  {job.state === 'assigned' && (
                    <button
                      onClick={() => markCollected.mutate(job.id)}
                      disabled={markCollected.isPending}
                      className="w-full bg-yellow-600 text-white py-2 px-4 rounded-md hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {markCollected.isPending ? 'Updating...' : 'Mark as Collected'}
                    </button>
                  )}

                  {job.state === 'collected' && (
                    <button
                      onClick={() => markDelivered.mutate(job.id)}
                      disabled={markDelivered.isPending}
                      className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {markDelivered.isPending ? 'Completing...' : 'Mark as Delivered'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Available Jobs */}
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Available Jobs ({availableJobs.length})
          </h2>
          
          {availableJobs.length === 0 ? (
            <div className="bg-white rounded-lg p-6 text-center">
              <div className="text-gray-400 mb-2">
                <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-1">No jobs available</h3>
              <p className="text-gray-600">Check back later for new pickup requests.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {availableJobs.map((job) => (
                <div key={job.id} className="bg-white rounded-lg shadow p-4 border border-gray-200">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {job.Bin?.Partner?.name || 'Unknown Partner'}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {job.Bin?.Partner?.address || 'Address not available'}
                      </p>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                      queued
                    </span>
                  </div>
                  
                  <div className="text-xs text-gray-500 mb-3">
                    <p>Bin ID: {job.bin_id.substring(0, 8)}...</p>
                    <p>Location: {job.Bin?.lat.toFixed(4)}, {job.Bin?.lng.toFixed(4)}</p>
                    <p>Requested: {new Date(job.created_at).toLocaleString()}</p>
                  </div>

                  <button
                    onClick={() => acceptJob.mutate(job.id)}
                    disabled={acceptJob.isPending}
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {acceptJob.isPending ? 'Accepting...' : 'Accept Job'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Stats */}
        <div className="bg-white rounded-lg p-4 border border-gray-200">
          <h3 className="font-medium text-gray-900 mb-2">Quick Stats</h3>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-blue-600">{availableJobs.length}</p>
              <p className="text-xs text-gray-600">Available</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">{myJobs.length}</p>
              <p className="text-xs text-gray-600">My Active</p>
            </div>
          </div>
        </div>
      </div>

      <ToastContainer
        position="top-center"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        className="!top-16"
      />
    </div>
  )
}
