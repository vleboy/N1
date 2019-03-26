// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 缓存工具
const Cache = require('./lib/Cache')


// 缓存测试
router.post('/redistest', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    
    const cache = new Cache()
    await cache.set('test',{user:'test'})
    let res = await cache.get('test')
    
    // 返回结果
    ctx.body = { code: 0, payload: res }
})
module.exports = router