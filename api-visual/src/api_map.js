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
 * 区域地图
 */
router.get('/map/:region', async (ctx, next) => {
    let r = await nodebatis.query('bill.insert', {})
    console.log(r)
    ctx.body = 'ssl work'
})

module.exports = router