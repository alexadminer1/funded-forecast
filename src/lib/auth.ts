import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET is not set')

export function verifyToken(token: string): { userId: number } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as unknown as { userId: number }
  } catch {
    return null
  }
}

export function signToken(payload: { userId: number }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' })
}
