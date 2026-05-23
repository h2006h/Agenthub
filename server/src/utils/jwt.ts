import jwt from 'jsonwebtoken'

const secret = process.env.JWT_SECRET || 'agenthub_secret_key'

export const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, secret, { expiresIn: '7d' })
}

export const verifyToken = (token: string): { userId: string } | null => {
  try {
    const decoded = jwt.verify(token, secret) as { userId: string }
    return decoded
  } catch {
    return null
  }
}
