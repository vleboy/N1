// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
const PassThrough = require('stream').PassThrough

router.get('/socket/balance', async function (ctx, next) {
    // 生成数据
    const content = Date.now()

    // 实时数据
    ctx.type = 'text/event-stream'
    ctx.set('Cache-Control', 'no-cache')
    ctx.set('Connection', 'keep-alive')
    // ctx.set('Transfer-Encoding', 'chunked')
    const stream = new PassThrough()
    const timerId = setInterval(function () {
        console.info(`data:${content}\n\n`)
        stream.write(`data:${content}\n\n`)
    }, 1000)

    // 错误关闭循环
    ctx.req.on('close', () => clearInterval(timerId))
    ctx.req.on('finish', () => clearInterval(timerId))
    ctx.req.on('error', () => clearInterval(timerId))

    // 数据推送
    ctx.body = stream
})

module.exports = router