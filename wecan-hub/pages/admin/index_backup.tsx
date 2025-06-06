import { useState, Fragment } from 'react'
import { Tab } from '@headlessui/react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast, ToastContainer } from 'react-toastify'
import { useUser } from '../../src/hooks/useUser'
import { supabase } from '../../src/lib/supabaseClient'
import { QRCodeSVG } from 'qrcode.react'
import 'react-toastify/dist/ReactToastify.css'

interface Partner {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  status: 'pending' | 'approved'
  created_at: string
}

interface Bin {
  id: string
  partner_id: string
  lat: number
  lng: number
  status: 'empty' | 'full' | 'needs_pickup'
  last_emptied_at: string | null
  Partner?: { id: string; name: string; status: string }
}

interface Pickup {
  id: string
  bin_id: string
  volunteer_id: string
  state: 'queued' | 'assigned' | 'collected' | 'delivered'
  created_at: string
  updated_at: string
}

interface Impact {
  cans: number
  revenue_pence: number
  meals: number
}

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ')
}

export default function AdminDashboard() {
  const { user, loading } = useUser()
    const queryClient = useQueryClient()
  const [editingBin, setEditingBin] = useState<string | null>(null)
  const [showQR, setShowQR] = useState<string | null>(null)

  const getReportUrl = (binId: string) => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/bins/${binId}/report`
    }
    return `https://your-domain.com/bins/${binId}/report`
  }

  const downloadQR = (binId: string, partnerName: string) => {
    const canvas = document.getElementById(`qr-${binId}`) as HTMLCanvasElement
    if (canvas) {
      const url = canvas.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `bin-${binId}-qr-${partnerName.replace(/[^a-zA-Z0-9]/g, '_')}.png`
      link.href = url
      link.click()
    }
  }

  // Queries
  const { data: pendingPartners = [] } = useQuery({
    queryKey: ['pendingPartners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Partner')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as Partner[]
    }
  })
  const { data: bins = [] } = useQuery({
    queryKey: ['bins'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Bin')
        .select(`
          *,
          Partner (
            id,
            name,
            status
          )
        `)
        .order('last_emptied_at', { ascending: true, nullsFirst: true })
      
      if (error) throw error
      return data as (Bin & { Partner: { id: string; name: string; status: string } })[]
    }
  })

  const { data: pickups = [] } = useQuery({
    queryKey: ['pickups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Pickup')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      return data as Pickup[]
    }
  })

  const { data: impact } = useQuery({
    queryKey: ['impact'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Impact')
        .select('cans, revenue_pence, meals')
      
      if (error) throw error
      
      const totals = data.reduce(
        (acc, curr) => ({
          cans: acc.cans + (curr.cans || 0),
          revenue_pence: acc.revenue_pence + (curr.revenue_pence || 0),
          meals: acc.meals + (curr.meals || 0)
        }),
        { cans: 0, revenue_pence: 0, meals: 0 }
      )
      
      return totals as Impact
    }
  })

  // Mutations
  const updatePartnerStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'approved' | 'pending' }) => {
      const { error } = await supabase
        .from('Partner')
        .update({ status })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingPartners'] })
      toast.success('Partner status updated')
    },
    onError: () => {
      toast.error('Failed to update partner status')
    }
  })

  const updateBin = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Bin> }) => {
      const { error } = await supabase
        .from('Bin')
        .update(updates)
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bins'] })
      setEditingBin(null)
      toast.success('Bin updated')
    },
    onError: () => {
      toast.error('Failed to update bin')
    }
  })

  const updatePickupState = useMutation({
    mutationFn: async ({ id, state }: { id: string; state: Pickup['state'] }) => {
      const { error } = await supabase
        .from('Pickup')
        .update({ state, updated_at: new Date().toISOString() })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pickups'] })
      toast.success('Pickup updated')
    },
    onError: () => {
      toast.error('Failed to update pickup')
    }
  })

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  const pickupsByState = {
    queued: pickups.filter(p => p.state === 'queued'),
    assigned: pickups.filter(p => p.state === 'assigned'),
    collected: pickups.filter(p => p.state === 'collected'),
    delivered: pickups.filter(p => p.state === 'delivered')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>
          
          <Tab.Group>
            <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/20 p-1 mb-8">
              {['Pending Partners', 'Bins', 'Pickups', 'Impact'].map((category) => (
                <Tab
                  key={category}
                  className={({ selected }) =>
                    classNames(
                      'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                      'ring-white ring-opacity-60 ring-offset-2 ring-offset-blue-400 focus:outline-none focus:ring-2',
                      selected
                        ? 'bg-white text-blue-700 shadow'
                        : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'
                    )
                  }
                >
                  {category}
                </Tab>
              ))}
            </Tab.List>
            
            <Tab.Panels>
              {/* Pending Partners Tab */}
              <Tab.Panel className="rounded-xl bg-white p-6 shadow">
                <h2 className="text-xl font-semibold mb-4">Pending Partners</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pendingPartners.map((partner) => (
                        <tr key={partner.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {partner.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {partner.address}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {partner.lat.toFixed(4)}, {partner.lng.toFixed(4)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(partner.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                            <button
                              onClick={() => updatePartnerStatus.mutate({ id: partner.id, status: 'approved' })}
                              className="text-indigo-600 hover:text-indigo-900"
                              disabled={updatePartnerStatus.isPending}
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => updatePartnerStatus.mutate({ id: partner.id, status: 'pending' })}
                              className="text-red-600 hover:text-red-900"
                              disabled={updatePartnerStatus.isPending}
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Tab.Panel>

              {/* Bins Tab */}
              <Tab.Panel className="rounded-xl bg-white p-6 shadow">
                <h2 className="text-xl font-semibold mb-4">Bins Management</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Partner</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Location</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Emptied</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">QR Code</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                      </tr>
                    </thead>                    <tbody className="bg-white divide-y divide-gray-200">
                      {bins.map((bin) => (
                        <tr key={bin.id}>
                          {/* Partner Name */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {bin.Partner?.name || 'Unknown Partner'}
                          </td>
                          {/* Location */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {bin.lat.toFixed(4)}, {bin.lng.toFixed(4)}
                          </td>
                          {/* Status */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            {editingBin === bin.id ? (
                              <select
                                defaultValue={bin.status}
                                onChange={(e) => {
                                  updateBin.mutate({
                                    id: bin.id,
                                    updates: { status: e.target.value as Bin['status'] }
                                  })
                                }}
                                className="text-sm border-gray-300 rounded-md"
                                aria-label="Change bin status"
                              >
                                <option value="empty">Empty</option>
                                <option value="full">Full</option>
                                <option value="needs_pickup">Needs Pickup</option>
                              </select>
                            ) : (                              <span className={classNames(
                                'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                                bin.status === 'empty' ? 'bg-green-100 text-green-800' :
                                bin.status === 'full' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              )}>
                                {bin.status}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => setShowQR(showQR === bin.id ? null : bin.id)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                QR
                              </button>
                              {showQR === bin.id && (
                                <div className="absolute z-10 bg-white p-4 border rounded shadow-lg">
                                  <QRCodeSVG
                                    id={`qr-${bin.id}`}
                                    value={getReportUrl(bin.id)}
                                    size={128}
                                  />
                                  <button
                                    onClick={() => downloadQR(bin.id, bin.Partner?.name || 'Unknown')}
                                    className="mt-2 block text-sm text-blue-600 hover:text-blue-900"
                                  >
                                    Download
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => setEditingBin(editingBin === bin.id ? null : bin.id)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              {editingBin === bin.id ? 'Cancel' : 'Edit'}
                            </button>
                          </td>
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => setShowQR(showQR === bin.id ? null : bin.id)}
                                className="text-indigo-600 hover:text-indigo-900 text-xs"
                              >
                                {showQR === bin.id ? 'Hide' : 'Show'} QR
                              </button>
                              <button
                                onClick={() => downloadQR(bin.id, bin.Partner?.name || 'Unknown')}
                                className="text-green-600 hover:text-green-900 text-xs"
                              >
                                Download
                              </button>
                            </div>                            {showQR === bin.id && (
                              <div className="mt-2 flex flex-col items-center">
                                <QRCodeSVG
                                  id={`qr-${bin.id}`}
                                  value={getReportUrl(bin.id)}
                                  size={80}
                                  level="M"
                                  includeMargin={true}
                                />
                                <p className="text-xs text-gray-500 mt-1 text-center">
                                  Scan to report full
                                </p>
                              </div>
                            )}
                          </td>
                          {/* Actions */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => setEditingBin(editingBin === bin.id ? null : bin.id)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              {editingBin === bin.id ? 'Cancel' : 'Edit'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Tab.Panel>

              {/* Pickups Tab */}
              <Tab.Panel className="rounded-xl bg-white p-6 shadow">
                <h2 className="text-xl font-semibold mb-4">Pickups Board</h2>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  {Object.entries(pickupsByState).map(([state, statePickups]) => (
                    <div key={state} className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-3 capitalize">
                        {state} ({statePickups.length})
                      </h3>
                      <div className="space-y-3">
                        {statePickups.map((pickup) => (
                          <div key={pickup.id} className="bg-white p-3 rounded-lg shadow-sm">
                            <div className="text-sm text-gray-600 mb-2">
                              Bin: {pickup.bin_id.substring(0, 8)}...
                            </div>
                            <div className="text-xs text-gray-500 mb-2">
                              {new Date(pickup.created_at).toLocaleDateString()}
                            </div>
                            <select
                              value={pickup.state}
                              onChange={(e) => updatePickupState.mutate({
                                id: pickup.id,
                                state: e.target.value as Pickup['state']
                              })}
                              className="text-xs border-gray-300 rounded w-full"
                              aria-label="Change pickup state"
                            >
                              <option value="queued">Queued</option>
                              <option value="assigned">Assigned</option>
                              <option value="collected">Collected</option>
                              <option value="delivered">Delivered</option>
                            </select>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Tab.Panel>

              {/* Impact Tab */}
              <Tab.Panel className="rounded-xl bg-white p-6 shadow">
                <h2 className="text-xl font-semibold mb-4">Impact Totals</h2>
                {impact && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-blue-50 p-6 rounded-lg">
                      <h3 className="text-lg font-medium text-blue-900 mb-2">Total Cans</h3>
                      <p className="text-3xl font-bold text-blue-600">{impact.cans.toLocaleString()}</p>
                    </div>
                    <div className="bg-green-50 p-6 rounded-lg">
                      <h3 className="text-lg font-medium text-green-900 mb-2">Revenue</h3>
                      <p className="text-3xl font-bold text-green-600">
                        £{(impact.revenue_pence / 100).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-purple-50 p-6 rounded-lg">
                      <h3 className="text-lg font-medium text-purple-900 mb-2">Meals Provided</h3>
                      <p className="text-3xl font-bold text-purple-600">{impact.meals.toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </Tab.Panel>
            </Tab.Panels>
          </Tab.Group>
        </div>
      </div>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  )
}
