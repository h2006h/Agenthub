import { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../utils/jwt'

declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权，请先登录' })
  }

  const token = authHeader.split(' ')[1]
  const decoded = verifyToken(token)
  if (!decoded) {
    return res.status(401).json({ error: 'token无效或已过期' })
  }

  req.userId = decoded.userId
  next()
}

export const unless = (paths: string[], middleware: (req: Request, res: Response, next: NextFunction) => void) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (paths.some(path => req.path.startsWith(path))) {
      return next()
    }
    return middleware(req, res, next)
  }
}
