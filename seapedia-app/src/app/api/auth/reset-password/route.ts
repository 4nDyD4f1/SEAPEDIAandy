import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function POST(request: NextRequest) {
  try {
    const { token, newPassword } = await request.json()

    if (!token || !newPassword) {
      return NextResponse.json({ error: 'Token dan Password Baru wajib diisi' }, { status: 400 })
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password minimal 8 karakter' }, { status: 400 })
    }

    // Cari user berdasarkan token yang masih berlaku
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date() // Expiry must be greater than current time
        }
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'Token tidak valid atau sudah kedaluwarsa' }, { status: 400 })
    }

    // Hash password baru
    const passwordHash = await bcrypt.hash(newPassword, 12)

    // Update user dan hapus tokennya
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
      }
    })

    return NextResponse.json({
      message: 'Password berhasil diubah. Silakan login menggunakan password baru Anda.'
    })

  } catch (error) {
    console.error('Reset password error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan internal' }, { status: 500 })
  }
}
