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
const ToolModel = require('./model/ToolModel')
const ToolCheck = require('./biz/ToolCheck')
const Model = require('./lib/Model').Model
const BizErr = require('./lib/Codes').BizErr


// 创建道具
router.post('/toolNew', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new ToolCheck().check(inparam)
    // 业务操作
    const addRet = await new ToolModel().addTool(inparam)
    // 操作日志记录
    inparam.operateAction = '创建道具'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, addRet)
    // 返回结果
    ctx.body = { code: 0, payload: addRet }
})

// 道具列表
router.post('/toolList', async function (ctx, next) {
    let inparam = ctx.request.body
    // 业务操作
    const ret = await new ToolModel().list(inparam)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 单个道具
router.post('/toolOne', async function (ctx, next) {
    let inparam = ctx.request.body
    // 业务操作
    const ret = await new ToolModel().getOne(inparam)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 道具状态变更
router.post('/toolChangeStatus', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new ToolCheck().checkStatus(inparam)
    // 业务操作
    const ret = await new ToolModel().changeStatus(inparam)
    // 操作日志记录
    inparam.operateAction = '道具状态变更'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, ret)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

//道具更新
router.post('/toolUpdate', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    //检查参数是否合法
    new ToolCheck().checkUpdate(inparam)
    // 业务操作
    const ret = await new ToolModel().updateTool(inparam)

    // 操作日志记录
    inparam.operateAction = '道具包更新'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, ret)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 删除
router.post('/toolDelete', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new ToolCheck().checkDelete(inparam)
    // 只有管理员
    if (!Model.isPlatformAdmin(token)) {
        throw BizErr.TokenErr('只有管理员可以操作')
    }
    // 业务操作
    const ret = await new ToolModel().delete(inparam)
    // 操作日志记录
    inparam.operateAction = '道具删除'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, ret)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 道具定价
router.post('/toolSetPrice', async function (ctx, next) {
    let inparam = ctx.request.body
    // 检查参数是否合法
    new ToolCheck().checkPrice(inparam)
    // 业务操作
    const ret = await new ToolModel().setPrice(inparam)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})



module.exports = router