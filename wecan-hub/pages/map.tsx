import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '../src/lib/supabaseClient'
import 'leaflet/dist/leaflet.css'

// Dynamic import for Leaflet to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
)
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
)
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
)

interface Partner {
  id: string
  name: string
  address: string
  lat: number
  lng: number
  status: 'approved'
}

interface Bin {
  id: string
  partner_id: string
  lat: number
  lng: number
  status: 'empty' | 'full'
  last_emptied_at: string | null
  Partner: Partner
}

export default function Map() {
  const [bins, setBins] = useState<Bin[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchBinsAndPartners = async () => {
      try {
        setLoading(true)
        
        // Fetch bins with their related approved partners
        const { data, error } = await supabase
          .from('Bin')
          .select(`
            id,
            partner_id,
            lat,
            lng,
            status,
            last_emptied_at,
            Partner!inner (
              id,
              name,
              address,
              lat,
              lng,
              status
            )
          `)
          .in('status', ['empty', 'full'])
          .eq('Partner.status', 'approved')

        if (error) throw error

        setBins(data as Bin[])
      } catch (err) {
        console.error('Error fetching bins:', err)
        setError('Failed to load bin locations')
      } finally {
        setLoading(false)
      }
    }

    fetchBinsAndPartners()
  }, [])

  // Fix for default Leaflet icons in Next.js
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const L = require('leaflet')
      
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      })
    }
  }, [])

  const getStatusBadge = (status: 'empty' | 'full') => {
    const baseClasses = 'px-2 py-1 text-xs font-semibold rounded-full'
    if (status === 'empty') {
      return `${baseClasses} bg-green-100 text-green-800`
    }
    return `${baseClasses} bg-yellow-100 text-yellow-800`
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading bin locations...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-600 mb-4">
            <svg className="h-12 w-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to load map</h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Default center (London) - you can adjust this based on your needs
  const defaultCenter: [number, number] = [51.5074, -0.1278]
  const defaultZoom = 10

  // If we have bins, center on the first one for better UX
  const mapCenter = bins.length > 0 ? [bins[0].lat, bins[0].lng] as [number, number] : defaultCenter

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bin Locator</h1>
              <p className="text-sm text-gray-600">
                Find recycling bins near you - {bins.length} locations available
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                  Empty
                </span>
                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                  Full
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {typeof window !== 'undefined' && (
          <MapContainer
            center={mapCenter}
            zoom={defaultZoom}
            style={{ height: '100%', width: '100%' }}
            className="z-0"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            {bins.map((bin) => (
              <Marker
                key={bin.id}
                position={[bin.lat, bin.lng]}
              >
                <Popup>
                  <div className="p-2 min-w-[200px]">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      {bin.Partner.name}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">
                      {bin.Partner.address}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className={getStatusBadge(bin.status)}>
                        {bin.status}
                      </span>
                      {bin.last_emptied_at && (
                        <span className="text-xs text-gray-500">
                          Last emptied: {new Date(bin.last_emptied_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-xs text-gray-500">
                      Coordinates: {bin.lat.toFixed(4)}, {bin.lng.toFixed(4)}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        )}
        
        {bins.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-75 z-10">
            <div className="text-center">
              <svg className="h-12 w-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No bins available</h3>
              <p className="text-gray-600">No recycling bins are currently available in your area.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
