import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(req: Request) {
  const { action, data, apiKey } = await req.json()

  // простой ключ доступа для Claude
  if (apiKey !== 'agent_secret_123') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // пример действий
    if (action === 'getUsers') {
      const users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          createdAt: true
        }
      })

      return NextResponse.json({ users })
    }

    if (action === 'createUser') {
      const user = await prisma.user.create({
        data: {
          email: data.email,
          password: data.password
        }
      })

      return NextResponse.json({ user })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
