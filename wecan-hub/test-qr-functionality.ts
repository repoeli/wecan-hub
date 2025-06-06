// QR Code Functionality Test
// This file tests the QR code generation and download functionality

import { QRCodeSVG } from 'qrcode.react'

// Test URL generation
const testBinId = 'test-bin-123'
const getReportUrl = (binId: string) => {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/bins/${binId}/report`
  }
  return `https://your-domain.com/bins/${binId}/report`
}

// Test QR code generation
const testQRCode = () => {
  const url = getReportUrl(testBinId)
  console.log('Generated QR URL:', url)
  
  // Should generate: http://localhost:3000/bins/test-bin-123/report
  // This URL should work when scanned and redirect to the report page
}

// Test download functionality
const testDownload = () => {
  const svg = document.getElementById(`qr-${testBinId}`) as SVGElement
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
        link.download = `bin-${testBinId}-qr-test.png`
        link.href = canvas.toDataURL('image/png')
        link.click()
      }
      URL.revokeObjectURL(url)
    }
    
    img.src = url
  }
}

export { testQRCode, testDownload, getReportUrl }
