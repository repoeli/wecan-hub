import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../src/lib/supabaseClient'

export default function BinReport() {
  const router = useRouter()
  const { id } = router.query
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const reportBinFull = async () => {
      if (!id || typeof id !== 'string') {
        setError('Invalid bin ID')
        setStatus('error')
        return
      }

      try {
        // Update bin status to 'full'
        const { error } = await supabase
          .from('Bin')
          .update({ status: 'full' })
          .eq('id', id)

        if (error) {
          throw error
        }

        setStatus('success')
      } catch (err) {
        console.error('Error updating bin status:', err)
        setError('Failed to report bin as full. Please try again.')
        setStatus('error')
      }
    }

    if (router.isReady) {
      reportBinFull()
    }
  }, [id, router.isReady])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Reporting bin status...</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
          <div className="text-red-600 mb-4">
            <svg className="h-16 w-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Oops!</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
        <div className="text-green-600 mb-6">
          <svg className="h-16 w-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Thank You!
        </h1>
        
        <p className="text-gray-600 mb-6">
          We've received your report that this bin is full. A driver will collect it soon!
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>What happens next?</strong><br />
            Our collection team has been notified and will prioritize this bin for pickup within the next 24-48 hours.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => router.push('/map')}
            className="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 transition-colors"
          >
            View All Bins
          </button>
          
          <button
            onClick={() => window.close()}
            className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition-colors"
          >
            Close
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Bin ID: {id}
          </p>
        </div>
      </div>
    </div>
  )
}
