// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const nodebatis = global.nodebatis
const IP2Region = require('ip2region')
const ipquery = new IP2Region()
const axios = require('axios')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })

/**
 * 测试SSL
 */
router.get('/test', async function (ctx, next) {
    ctx.body = 'ssl work'
    let p = nodebatis.execute('user.add', { username: '123', password: '456' })
    console.log(p)
})

module.exports = router