import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email wajib diisi' }, { status: 400 })
    }

    // Cari user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (!user) {
      // Untuk alasan keamanan, kita tetap pura-pura sukses agar attacker tidak tahu email mana yang terdaftar
      return NextResponse.json({ message: 'Jika email terdaftar, tautan reset telah dikirim.' })
    }

    // Buat token 64 karakter hex
    const resetToken = crypto.randomBytes(32).toString('hex')
    // Set kedaluwarsa 1 jam (3600000 ms) dari sekarang
    const resetTokenExpiry = new Date(Date.now() + 3600000)

    // Simpan ke DB
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    })

    // KARENA KITA TIDAK ADA SERVER EMAIL, KITA KIRIM TOKEN INI SEBAGAI RESPONSE UNTUK DISIMULASIKAN DI UI
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${resetToken}`

    return NextResponse.json({
      message: 'Jika email terdaftar, tautan reset telah dikirim.',
      // HANYA UNTUK KEPERLUAN DEVELOPMENT / SIMULASI UI:
      _simulatedEmail: {
        to: user.email,
        subject: 'Reset Password Akun SEAPEDIA',
        resetLink,
      }
    })

  } catch (error) {
    console.error('Forgot password error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan internal' }, { status: 500 })
  }
}
