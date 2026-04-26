import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { signToken } from '@/lib/auth'

export async function POST(req: Request) {
  const { email, password } = await req.json()

  if (!email || !password) {
    return NextResponse.json({ error: 'Missing data' }, { status: 400 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    })

    if (!user || !user.password) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const isValid = await bcrypt.compare(password, user.password)

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const token = signToken({ userId: user.id })

    return NextResponse.json({ success: true, token })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
