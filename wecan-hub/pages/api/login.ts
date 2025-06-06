import type { NextApiRequest, NextApiResponse } from 'next'
import { supabase } from '../../src/lib/supabaseClient'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email } = req.body

  if (!email) {
    return res.status(400).json({ error: 'Email is required' })
  }

  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${req.headers.origin}/auth/callback`
      }
    })

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    return res.status(200).json({ success: true, data })
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error' })
  }
}
