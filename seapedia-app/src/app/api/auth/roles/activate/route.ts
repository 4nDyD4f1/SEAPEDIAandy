import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyToken, signToken } from '@/lib/auth'

export async function POST(request: NextRequest) {
  try {
    const tokenCookie = request.cookies.get('seapedia_token')
    if (!tokenCookie?.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const authUser = verifyToken(tokenCookie.value)

    const { role, storeName, storeAddress } = await request.json()

    if (!['SELLER', 'DRIVER'].includes(role)) {
      return NextResponse.json({ error: 'Role tidak valid' }, { status: 400 })
    }

    // Cek apakah sudah punya role ini
    const existingRole = await prisma.userRole.findUnique({
      where: {
        userId_role: { userId: authUser.userId, role }
      }
    })

    if (existingRole) {
      return NextResponse.json({ error: `Anda sudah memiliki akses sebagai ${role}` }, { status: 400 })
    }

    // Logika Khusus SELLER
    if (role === 'SELLER') {
      if (!storeName || !storeAddress) {
        return NextResponse.json({ error: 'Nama dan Alamat Toko wajib diisi' }, { status: 400 })
      }

      // Cek apakah nama toko sudah dipakai orang lain
      const existingStore = await prisma.store.findUnique({ where: { name: storeName } })
      if (existingStore) {
        return NextResponse.json({ error: 'Nama toko sudah digunakan orang lain. Pilih nama yang lebih unik!' }, { status: 400 })
      }

      // Buat Toko
      await prisma.store.create({
        data: {
          ownerId: authUser.userId,
          name: storeName,
          address: storeAddress,
        }
      })
    }

    // Tambahkan Role ke User
    await prisma.userRole.create({
      data: {
        userId: authUser.userId,
        role
      }
    })

    // Fetch daftar role terbaru dari DB
    const updatedUser = await prisma.user.findUnique({
      where: { id: authUser.userId },
      include: { roles: true }
    })

    if (!updatedUser) {
      return NextResponse.json({ error: 'Gagal memuat ulang data user' }, { status: 500 })
    }

    const roles = updatedUser.roles.map(r => r.role)
    const newActiveRole = role // Secara otomatis switch ke role yang baru diaktifkan

    // Buat token baru dengan daftar roles yang di-update
    const token = signToken({
      userId: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      roles,
      activeRole: newActiveRole,
    })

    const response = NextResponse.json({
      message: `Berhasil mengaktifkan role ${role}`,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        roles,
        activeRole: newActiveRole,
        walletBalance: updatedUser.walletBalance
      },
      token
    })

    // Pasang cookie baru agar tidak perlu login ulang
    response.cookies.set('seapedia_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return response

  } catch (error) {
    console.error('Role activation error:', error)
    return NextResponse.json({ error: 'Terjadi kesalahan internal' }, { status: 500 })
  }
}
