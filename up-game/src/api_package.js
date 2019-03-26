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
const PackageModel = require('./model/PackageModel')
const PackageCheck = require('./biz/PackageCheck')

// 创建道具包
router.post('/packageNew', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new PackageCheck().check(inparam)
    // 业务操作
    const addRet = await new PackageModel().add(inparam)
    // 操作日志记录
    inparam.operateAction = '创建道具包'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, addRet)
    // 返回结果
    ctx.body = { code: 0, payload: addRet }
})

// 道具包列表
router.post('/packageList', async function (ctx, next) {
    let inparam = ctx.request.body
    // 业务操作
    const ret = await new PackageModel().list(inparam)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 单个道具包
router.post('/packageOne', async function (ctx, next) {
    let inparam = ctx.request.body
    // 业务操作
    const ret = await new PackageModel().getOne(inparam.packageName, inparam.packageId)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 道具包状态变更
router.post('/packageChangeStatus', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new PackageCheck().checkStatus(inparam)
    // 业务操作
    const ret = await new PackageModel().changeStatus(inparam)
    // 操作日志记录
    inparam.operateAction = '道具状态变更'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, ret)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 道具包更新
router.post('/packageUpdate', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    //检查参数是否合法
    new PackageCheck().checkUpdate(inparam)
    // 业务操作
    const ret = await new PackageModel().update(inparam)
    // 操作日志记录
    inparam.operateAction = '道具包更新'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, ret)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 道具包删除
router.post('/packageDelete', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new PackageCheck().checkDelete(inparam)
    // 业务操作
    const ret = await new PackageModel().delete(inparam)
    // 操作日志记录
    inparam.operateAction = '道具包删除'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, ret)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

module.exports = router