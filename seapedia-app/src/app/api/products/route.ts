import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/products - Public product catalog
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const storeId = searchParams.get('storeId') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '12')
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = {
      stock: { gt: 0 },
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { description: { contains: search } },
      ]
    }

    if (category) {
      where.category = category
    }

    if (storeId) {
      where.storeId = storeId
    }

    const [productsRaw, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          store: {
            select: { id: true, name: true, ownerId: true },
          },
          orderItems: {
            include: {
              order: {
                include: { review: true }
              }
            }
          }
        },
      }),
      prisma.product.count({ where }),
    ])

    const products = productsRaw.map((product) => {
      let totalSold = 0
      let totalRating = 0
      let reviewCount = 0

      for (const item of product.orderItems) {
        // Count sold items (completed orders)
        if (item.order.status === 'PESANAN_SELESAI' || item.order.status === 'MENUNGGU_REFUND' || item.order.status === 'DIKEMBALIKAN') {
          totalSold += item.quantity
        }
        // Count reviews
        if (item.order.review) {
          totalRating += item.order.review.rating
          reviewCount += 1
        }
      }

      const { orderItems, ...rest } = product
      return {
        ...rest,
        soldCount: totalSold,
        rating: reviewCount > 0 ? Number((totalRating / reviewCount).toFixed(1)) : null,
        reviewCount
      }
    })

    // Get categories for filter
    const categories = await prisma.product.findMany({
      select: { category: true },
      distinct: ['category'],
      where: { category: { not: null } },
    })

    return NextResponse.json({
      products,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      categories: categories.map((c) => c.category).filter(Boolean),
    })
  } catch (error) {
    console.error('Products fetch error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
