import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/api-auth'

// GET /api/admin/stats
export async function GET(request: NextRequest) {
  const { auth, error } = requireAuth(request, 'ADMIN')
  if (error) return error

  try {
    const [
      usersTotal, usersBuyer, usersSeller, usersDriver,
      storesTotal, productsTotal, productsOOS,
      ordersTotal, ordersActive, ordersCompleted, ordersRefunded,
      vouchersTotal, vouchersActive,
      deliveriesOngoing, deliveriesCompleted,
      revenueAgg
    ] = await Promise.all([
      // Users
      prisma.user.count(),
      prisma.user.count({ where: { roles: { some: { role: 'BUYER' } } } }),
      prisma.user.count({ where: { roles: { some: { role: 'SELLER' } } } }),
      prisma.user.count({ where: { roles: { some: { role: 'DRIVER' } } } }),
      
      // Stores & Products
      prisma.store.count(),
      prisma.product.count(),
      prisma.product.count({ where: { stock: 0 } }),

      // Orders
      prisma.order.count(),
      prisma.order.count({ where: { status: { in: ['SEDANG_DIKEMAS', 'MENUNGGU_PENGIRIM', 'SEDANG_DIKIRIM'] } } }),
      prisma.order.count({ where: { status: 'PESANAN_SELESAI' } }),
      prisma.order.count({ where: { status: 'DIKEMBALIKAN' } }),

      // Vouchers
      prisma.voucher.count(),
      prisma.voucher.count({ where: { OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),

      // Delivery Jobs
      prisma.order.count({ where: { status: 'SEDANG_DIKIRIM' } }),
      prisma.order.count({ where: { status: 'PESANAN_SELESAI', driverId: { not: null } } }),

      // Financials
      prisma.order.aggregate({
        where: { status: { in: ['PESANAN_SELESAI', 'SEDANG_DIKIRIM'] } },
        _sum: { total: true, discountAmount: true }
      }),
    ])

    const ordersByStatus = await prisma.order.groupBy({ by: ['status'], _count: { _all: true } })
    const formattedOrdersByStatus = ordersByStatus.map(o => ({ status: o.status, _count: o._count._all }))

    return NextResponse.json({
      users: { total: usersTotal, buyers: usersBuyer, sellers: usersSeller, drivers: usersDriver },
      stores: { total: storesTotal },
      products: { total: productsTotal, outOfStock: productsOOS },
      orders: { total: ordersTotal, active: ordersActive, completed: ordersCompleted, refunded: ordersRefunded, overdue: ordersRefunded },
      vouchers: { total: vouchersTotal, active: vouchersActive },
      deliveryJobs: { ongoing: deliveriesOngoing, completed: deliveriesCompleted },
      financials: { 
        totalTransactionValue: revenueAgg._sum.total || 0,
        totalDiscountGiven: revenueAgg._sum.discountAmount || 0,
        totalVoucherUsage: 0 // Mocked for now, since usage count requires tracking
      },
      ordersByStatus: formattedOrdersByStatus
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
