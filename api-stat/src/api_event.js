// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const UserModel = require('./model/UserModel')

// /**
//  * 触发统计金额map
//  */
// router.post('/stat/cronAmountMap', async function (ctx, next) {
//     const inparam = ctx.request.body
//     // 业务操作
//     new Promise((resolve, reject) => { new UserModel().calcAllAmount() })
//     ctx.body = { code: 0, msg: 'Y' }
// })

/**
 * 触发免转钱包金额map
 */
router.post('/stat/cronTransferMap', async function (ctx, next) {
    const inparam = ctx.request.body
    // 业务操作
    new Promise((resolve, reject) => { new UserModel().calcTransferAmount() })
    ctx.body = { code: 0, msg: 'Y' }
})

module.exports = router