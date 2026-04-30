export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcrypt'
import { signToken } from '@/lib/auth'

const STARTING_BALANCE = 10000.00

export async function POST(req: NextRequest) {
  let body: {
    email: string
    password: string
    username: string
    firstName: string
    lastName: string
    acceptedPayoutRules: boolean
    acceptedPrivacy: boolean
  }

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { email, password, username, firstName, lastName, acceptedPayoutRules, acceptedPrivacy } = body

  // Validation
  if (!email || !password || !username || !firstName || !lastName) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (!acceptedPayoutRules || !acceptedPrivacy) {
    return NextResponse.json({ error: 'Must accept terms and payout rules' }, { status: 400 })
  }

  if (password.length < 10) {
    return NextResponse.json({ error: 'Password must be at least 10 characters' }, { status: 400 })
  }

  if (!/[A-Z]/.test(password)) {
    return NextResponse.json({ error: 'Password must contain at least one uppercase letter' }, { status: 400 })
  }

  if (!/[a-z]/.test(password)) {
    return NextResponse.json({ error: 'Password must contain at least one lowercase letter' }, { status: 400 })
  }

  if (!/[0-9]/.test(password)) {
    return NextResponse.json({ error: 'Password must contain at least one number' }, { status: 400 })
  }

  if (username.length < 3 || username.length > 50) {
    return NextResponse.json({ error: 'Username must be 3-50 characters' }, { status: 400 })
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return NextResponse.json({ error: 'Username can only contain letters, numbers and underscores' }, { status: 400 })
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10)

    const result = await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          username: username.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          provider: 'email',
          membershipStatus: 'free',
        },
      })

      // Record consent
      await tx.userConsent.create({
        data: {
          userId: user.id,
          acceptedPayoutRules: true,
          acceptedPrivacy: true,
          acceptedAt: new Date(),
        },
      })

      // Create starting balance log
      await tx.balanceLog.create({
        data: {
          userId: user.id,
          tradeId: null,
          challengeId: null,
          type: 'challenge_start',
          amount: STARTING_BALANCE,
          balanceBefore: 0,
          balanceAfter: STARTING_BALANCE,
          runningBalance: STARTING_BALANCE,
        },
      })

      // Audit log
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          targetType: 'user',
          targetId: String(user.id),
          category: 'user',
          action: 'user_registered',
          metadata: { provider: 'email' },
        },
      })

      return user
    })

    const token = signToken({ userId: result.id })

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: result.id,
        email: result.email,
        username: result.username,
        firstName: result.firstName,
        lastName: result.lastName,
      },
    })

  } catch (e: unknown) {
    const error = e as { code?: string }

    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Email or username already exists' }, { status: 400 })
    }

    console.error('[REGISTER]', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
