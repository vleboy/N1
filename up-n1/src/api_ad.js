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
const LogModel = require('./model/LogModel')
const AdModel = require('./model/AdModel')
const UserModel = require('./model/UserModel')
const AdCheck = require('./biz/AdCheck')
const Model = require('./lib/Model').Model
const RoleCodeEnum = require('./lib/UserConsts').RoleCodeEnum

// 创建公告
router.post('/adNew', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new AdCheck().check(inparam)
    // 业务操作，兼容包站业务
    if (inparam.operatorName) {
        let user = await new UserModel().getUserByName(RoleCodeEnum.Merchant, inparam.operatorName)
        inparam.operatorName = user.username
        inparam.operatorRole = user.role
        inparam.operatorMsn = user.msn || Model.StringValue
        inparam.operatorId = user.userId
        inparam.operatorDisplayName = user.displayName
        inparam.operatorDisplayId = user.displayId
        inparam.operatorSn = user.sn
    } else {
        inparam.operatorName = token.username
        inparam.operatorRole = token.role
        inparam.operatorMsn = token.msn || Model.StringValue
        inparam.operatorId = token.userId
        inparam.operatorDisplayName = token.displayName
        inparam.operatorDisplayId = token.displayId
        inparam.operatorSn = token.sn
    }
    const addRet = await new AdModel().addAd(inparam)
    // 操作日志记录
    inparam.operateAction = '创建公告'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, addRet)
    // 返回结果
    ctx.body = { code: 0, payload: addRet }
})

// 公告列表
router.post('/adList', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 业务操作
    inparam.token = token
    const ret = await new AdModel().list(inparam)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 单个公告
router.post('/adOne', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 业务操作
    const ret = await new AdModel().getOne(inparam)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 变更公告状态
router.post('/adChangeStatus', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    //检查参数是否合法
    new AdCheck().checkStatus(inparam)
    // 业务操作
    const ret = await new AdModel().changeStatus(inparam)
    // 操作日志记录
    inparam.operateAction = '公告状态变更'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, ret)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 公告更新
router.post('/adUpdate', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new AdCheck().checkUpdate(inparam)
    // 业务操作
    const ret = await new AdModel().updateAd(inparam)
    // 操作日志记录
    inparam.operateAction = '公告更新'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, ret)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 公告删除
router.post('/adDelete', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new AdCheck().checkDelete(inparam)
    if (!Model.isPlatformAdmin(token)) {
        let adRes = await new AdModel().getOne(inparam)
        if (adRes) {
            if (adRes.operatorName != token.username) {
                throw { "code": -1, "msg": "你没有权限！" }
            }
        } else {
            throw { "code": -1, "msg": "公共不存在" }
        }
    }
    // 业务操作
    const ret = await new AdModel().delete(inparam)
    // 操作日志记录
    inparam.operateAction = '公告删除'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, ret)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

module.exports = router