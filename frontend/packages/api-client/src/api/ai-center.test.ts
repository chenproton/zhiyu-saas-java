import { afterEach, describe, expect, it, vi } from 'vitest'
import { streamAICenter } from './ai-center'

// 构造返回 text/event-stream 的响应：按块吐出给定文本片段后正常结束
function sseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

// 构造首读即抛错的流式响应（模拟流中途传输错误 / 取消）
function errorResponse(err: Error): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.error(err)
    },
  })
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

describe('streamAICenter SSE 解析', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('解析 meta/delta/done 事件（\\n 分隔）', async () => {
    globalThis.fetch = vi.fn(async () =>
      sseResponse([
        'event: meta\ndata: {"conversationId":"c1","messageId":"m1"}\n\n',
        'event: delta\ndata: {"text":"你好"}\n\n',
        'event: done\ndata: {"ok":true}\n\n',
      ]),
    )
    const onMeta = vi.fn()
    const onDelta = vi.fn()
    const onDone = vi.fn()
    await streamAICenter('/ai/kb/1/ask', { message: 'hi' }, { onMeta, onDelta, onDone })
    expect(onMeta).toHaveBeenCalledWith({ conversationId: 'c1', messageId: 'm1' })
    expect(onDelta).toHaveBeenCalledWith('你好')
    expect(onDone).toHaveBeenCalledWith({ ok: true })
  })

  it('兼容 \\r\\n 行结束符', async () => {
    globalThis.fetch = vi.fn(async () => sseResponse(['event: delta\r\ndata: {"text":"好"}\r\n\r\n']))
    const onDelta = vi.fn()
    await streamAICenter('/ai/kb/1/ask', { message: 'hi' }, { onDelta })
    expect(onDelta).toHaveBeenCalledWith('好')
  })

  it('多行 data 按 \\n 拼接后整体解析', async () => {
    globalThis.fetch = vi.fn(async () =>
      sseResponse(['event: meta\ndata: {"conversationId":"c1",\ndata: "messageId":"m1"}\n\n']),
    )
    const onMeta = vi.fn()
    await streamAICenter('/ai/kb/1/ask', { message: 'hi' }, { onMeta })
    expect(onMeta).toHaveBeenCalledWith({ conversationId: 'c1', messageId: 'm1' })
  })

  it('流结束刷新未以空行结尾的最后事件', async () => {
    globalThis.fetch = vi.fn(async () => sseResponse(['event: delta\ndata: {"text":"尾"}']))
    const onDelta = vi.fn()
    await streamAICenter('/ai/kb/1/ask', { message: 'hi' }, { onDelta })
    expect(onDelta).toHaveBeenCalledWith('尾')
  })

  it('无 event 字段的事件不沿用上一个事件类型', async () => {
    globalThis.fetch = vi.fn(async () =>
      sseResponse([
        'event: meta\ndata: {"conversationId":"c1"}\n\n',
        'data: {"text":"默认 message 事件"}\n\n',
      ]),
    )
    const onMeta = vi.fn()
    const onDelta = vi.fn()
    await streamAICenter('/ai/kb/1/ask', { message: 'hi' }, { onMeta, onDelta })
    expect(onMeta).toHaveBeenCalledTimes(1)
    expect(onDelta).not.toHaveBeenCalled()
  })

  it('流中途传输错误经 onError 回调，不抛异常', async () => {
    globalThis.fetch = vi.fn(async () => errorResponse(new Error('network down')))
    const onError = vi.fn()
    await expect(
      streamAICenter('/ai/kb/1/ask', { message: 'hi' }, { onError }),
    ).resolves.toBeUndefined()
    expect(onError).toHaveBeenCalledWith('stream_error', 'network down')
  })

  it('AbortError 向上抛且不触发 onError（调用方据此区分取消）', async () => {
    const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' })
    globalThis.fetch = vi.fn(async () => errorResponse(abortErr))
    const onError = vi.fn()
    await expect(
      streamAICenter('/ai/kb/1/ask', { message: 'hi' }, { onError }),
    ).rejects.toBe(abortErr)
    expect(onError).not.toHaveBeenCalled()
  })

  it('闲置超时经 onError 回调（不抛异常）', async () => {
    vi.useFakeTimers()
    try {
      // 永不产生数据也不关闭的流：触发闲置超时
      const stream = new ReadableStream<Uint8Array>({
        start() {},
      })
      globalThis.fetch = vi.fn(
        async () =>
          new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } }),
      )
      const onError = vi.fn()
      const pending = streamAICenter('/ai/kb/1/ask', { message: 'hi' }, { onError })
      await vi.advanceTimersByTimeAsync(60_000)
      await pending
      expect(onError).toHaveBeenCalledWith('stream_error', '流式响应超时')
    } finally {
      vi.useRealTimers()
    }
  })
})
