class WebSocketClient {
  private ws: WebSocket | null = null
  private url: string
  private listeners: Map<string, Set<(payload: unknown) => void>> = new Map()

  constructor(url?: string) {
    this.url = url || `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.hostname}:3000`
  }

  connect(token?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        console.log('WebSocket connected')
        this.notify('connected', {})
        if (token) {
          this.send('auth', { token })
        }
        resolve()
      }

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        reject(error)
      }

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected')
        this.notify('disconnected', { code: event.code, reason: event.reason })
      }

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          this.handleMessage(message)
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }
    })
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  send(type: string, payload: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }))
    }
  }

  subscribe(conversationId: string): void {
    this.send('subscribe', { conversationId })
  }

  unsubscribe(conversationId: string): void {
    this.send('unsubscribe', { conversationId })
  }

  sendMessage(
    conversationId: string,
    senderId: string,
    senderName: string,
    content: string,
    type: string = 'text'
  ): void {
    this.send('sendMessage', {
      conversationId,
      senderId,
      senderName,
      content,
      type
    })
  }

  on(type: string, callback: (payload: unknown) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    this.listeners.get(type)!.add(callback)
  }

  off(type: string, callback: (payload: unknown) => void): void {
    const callbacks = this.listeners.get(type)
    if (callbacks) {
      callbacks.delete(callback)
    }
  }

  private notify(type: string, payload: unknown): void {
    const callbacks = this.listeners.get(type)
    if (callbacks) {
      callbacks.forEach((callback) => callback(payload))
    }
  }

  private handleMessage(message: { type: string; payload: unknown }): void {
    switch (message.type) {
      case 'newMessage':
        this.notify('message', message.payload)
        break
      case 'agentReplyStart':
        this.notify('agentReplyStart', message.payload)
        break
      case 'agentChunk':
        this.notify('agentChunk', message.payload)
        break
      case 'agentReplyEnd':
        this.notify('agentReplyEnd', message.payload)
        break
      case 'agentReplyError':
        this.notify('agentReplyError', message.payload)
        break
      case 'deployStatus':
        this.notify('deployStatus', message.payload)
        break
      case 'error':
        this.notify('error', message.payload)
        break
      default:
        this.notify(message.type, message.payload)
    }
  }

  reconnect(token?: string): void {
    this.disconnect()
    setTimeout(() => {
      this.connect(token)
    }, 3000)
  }
}

export const websocketClient = new WebSocketClient()
