// 路由相关
const Router = require('koa-router')
const router = new Router()

// PING
router.get('/ping', async function (ctx, next) {
    ctx.body = 'Y'
})

module.exports = router