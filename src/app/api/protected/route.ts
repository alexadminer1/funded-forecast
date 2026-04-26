import { NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')

  if (!authHeader) {
    return NextResponse.json({ error: 'No token' }, { status: 401 })
  }

  const token = authHeader.replace('Bearer ', '')

  try {
    const decoded = jwt.verify(token, 'super_secret_key_123') as { userId: number }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      message: 'Access granted',
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt
      }
    })
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
  }
}
