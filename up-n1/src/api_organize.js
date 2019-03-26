
// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const UserModel = require('./model/UserModel')

/**
 * 组织架构
 */
router.post('/organize', async function (ctx, next) {
    let inparam = ctx.request.body
    inparam.token = ctx.tokenVerify
    const queryRet = await new UserModel().organize(inparam)
    // 返回结果
    ctx.body = { code: 0, payload: queryRet }
})


module.exports = router