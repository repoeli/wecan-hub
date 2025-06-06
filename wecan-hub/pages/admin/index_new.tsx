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
    // Create a temporary canvas to convert SVG to PNG
    const svg = document.getElementById(`qr-${binId}`) as unknown as SVGElement
    if (svg) {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()
      
      // Set canvas size
      canvas.width = 200
      canvas.height = 200
      
      // Convert SVG to data URL
      const svgData = new XMLSerializer().serializeToString(svg)
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
      const url = URL.createObjectURL(svgBlob)
      
      img.onload = () => {
        if (ctx) {
          ctx.fillStyle = 'white'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          
          // Download
          const link = document.createElement('a')
          link.download = `bin-${binId}-qr-${partnerName.replace(/[^a-zA-Z0-9]/g, '_')}.png`
          link.href = canvas.toDataURL('image/png')
          link.click()
        }
        URL.revokeObjectURL(url)
      }
      
      img.src = url
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
      return data as Bin[]
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
        .select('*')
        .single()
      
      if (error) throw error
      return data as Impact
    }
  })

  // Mutations
  const approvePartner = useMutation({
    mutationFn: async (partnerId: string) => {
      const { error } = await supabase
        .from('Partner')
        .update({ status: 'approved' })
        .eq('id', partnerId)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingPartners'] })
      toast.success('Partner approved successfully')
    },
    onError: (error) => {
      toast.error('Failed to approve partner')
      console.error(error)
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
      toast.success('Bin updated successfully')
    },
    onError: (error) => {
      toast.error('Failed to update bin')
      console.error(error)
    }
  })

  const updatePickup = useMutation({
    mutationFn: async ({ id, state }: { id: string; state: Pickup['state'] }) => {
      const { error } = await supabase
        .from('Pickup')
        .update({ state, updated_at: new Date().toISOString() })
        .eq('id', id)
      
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pickups'] })
      toast.success('Pickup updated successfully')
    },
    onError: (error) => {
      toast.error('Failed to update pickup')
      console.error(error)
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Please log in to access the admin dashboard</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Admin Dashboard</h1>
          
          <Tab.Group>
            <Tab.List className="flex space-x-1 rounded-xl bg-blue-900/20 p-1">
              <Tab as={Fragment}>
                {({ selected }) => (
                  <button
                    className={classNames(
                      'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                      selected
                        ? 'bg-white text-blue-700 shadow'
                        : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'
                    )}
                  >
                    Pending Partners
                  </button>
                )}
              </Tab>
              <Tab as={Fragment}>
                {({ selected }) => (
                  <button
                    className={classNames(
                      'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                      selected
                        ? 'bg-white text-blue-700 shadow'
                        : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'
                    )}
                  >
                    Bins
                  </button>
                )}
              </Tab>
              <Tab as={Fragment}>
                {({ selected }) => (
                  <button
                    className={classNames(
                      'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                      selected
                        ? 'bg-white text-blue-700 shadow'
                        : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'
                    )}
                  >
                    Pickups
                  </button>
                )}
              </Tab>
              <Tab as={Fragment}>
                {({ selected }) => (
                  <button
                    className={classNames(
                      'w-full rounded-lg py-2.5 text-sm font-medium leading-5',
                      selected
                        ? 'bg-white text-blue-700 shadow'
                        : 'text-blue-100 hover:bg-white/[0.12] hover:text-white'
                    )}
                  >
                    Impact
                  </button>
                )}
              </Tab>
            </Tab.List>
            
            <Tab.Panels className="mt-2">
              {/* Pending Partners Tab */}
              <Tab.Panel className="rounded-xl bg-white p-3">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Address
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Submitted
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
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
                            {new Date(partner.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => approvePartner.mutate(partner.id)}
                              disabled={approvePartner.isPending}
                              className="text-indigo-600 hover:text-indigo-900 disabled:opacity-50"
                            >
                              {approvePartner.isPending ? 'Approving...' : 'Approve'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Tab.Panel>

              {/* Bins Tab */}
              <Tab.Panel className="rounded-xl bg-white p-3">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Partner
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Location
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last Emptied
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          QR Code
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {bins.map((bin) => (
                        <tr key={bin.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {bin.Partner?.name || 'Unknown Partner'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {bin.lat.toFixed(4)}, {bin.lng.toFixed(4)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {editingBin === bin.id ? (
                              <select
                                value={bin.status}
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
                            ) : (
                              <span className={classNames(
                                'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                                bin.status === 'empty' ? 'bg-green-100 text-green-800' :
                                bin.status === 'full' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-red-100 text-red-800'
                              )}>
                                {bin.status}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {bin.last_emptied_at ? new Date(bin.last_emptied_at).toLocaleDateString() : 'Never'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <div className="flex flex-col space-y-2">
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => setShowQR(showQR === bin.id ? null : bin.id)}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  {showQR === bin.id ? 'Hide' : 'Show'} QR
                                </button>
                                <button
                                  onClick={() => downloadQR(bin.id, bin.Partner?.name || 'Unknown')}
                                  className="text-green-600 hover:text-green-900"
                                >
                                  Download
                                </button>
                              </div>
                              {showQR === bin.id && (
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
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Tab.Panel>

              {/* Pickups Tab */}
              <Tab.Panel className="rounded-xl bg-white p-3">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Bin ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Volunteer ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          State
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Created
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pickups.map((pickup) => (
                        <tr key={pickup.id}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {pickup.bin_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {pickup.volunteer_id}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={classNames(
                              'px-2 inline-flex text-xs leading-5 font-semibold rounded-full',
                              pickup.state === 'queued' ? 'bg-gray-100 text-gray-800' :
                              pickup.state === 'assigned' ? 'bg-blue-100 text-blue-800' :
                              pickup.state === 'collected' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                            )}>
                              {pickup.state}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(pickup.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <select
                              value={pickup.state}
                              onChange={(e) => updatePickup.mutate({
                                id: pickup.id,
                                state: e.target.value as Pickup['state']
                              })}
                              className="text-sm border-gray-300 rounded-md"
                              aria-label="Change pickup state"
                            >
                              <option value="queued">Queued</option>
                              <option value="assigned">Assigned</option>
                              <option value="collected">Collected</option>
                              <option value="delivered">Delivered</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Tab.Panel>

              {/* Impact Tab */}
              <Tab.Panel className="rounded-xl bg-white p-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-blue-900 mb-2">Cans Collected</h3>
                    <p className="text-3xl font-bold text-blue-600">{impact?.cans || 0}</p>
                  </div>
                  <div className="bg-green-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-green-900 mb-2">Revenue Generated</h3>
                    <p className="text-3xl font-bold text-green-600">£{((impact?.revenue_pence || 0) / 100).toFixed(2)}</p>
                  </div>
                  <div className="bg-purple-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-purple-900 mb-2">Meals Funded</h3>
                    <p className="text-3xl font-bold text-purple-600">{impact?.meals || 0}</p>
                  </div>
                </div>
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
