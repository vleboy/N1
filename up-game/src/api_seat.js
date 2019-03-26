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
const SeatModel = require('./model/SeatModel')
const SeatCheck = require('./biz/SeatCheck')
const Model = require('./lib/Model').Model
const SeatTypeEnum = require('./lib/Consts').SeatTypeEnum

// 创建
router.post('/seatNew', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new SeatCheck().check(inparam)
    // 业务操作
    inparam.operatorName = token.username
    inparam.operatorRole = token.role
    inparam.operatorMsn = token.msn || Model.StringValue
    inparam.operatorId = token.userId
    inparam.operatorDisplayName = token.displayName
    inparam.token = token
    inparam.operatorDisplayId = token.displayId || Model.StringValue
    inparam.operatorSn = token.sn || Model.StringValue
    const addRet = await new SeatModel().add(inparam)
    // 操作日志记录
    inparam.operateAction = '创建展位'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, addRet)
    // 返回结果
    ctx.body = { code: 0, payload: addRet }
})

// 列表
router.post('/seatList', async function (ctx, next) {
    let inparam = ctx.request.body
    // 检查参数是否合法
    new SeatCheck().checkQuery(inparam)
    // 业务操作
    inparam.token = ctx.tokenVerify
    const ret = await new SeatModel().list(inparam)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 所有商户列表
router.post('/seatAllList', async function (ctx, next) {
    let inparam = ctx.request.body
    // 检查参数是否合法
    new SeatCheck().checkQuery(inparam)
    // 业务操作
    inparam.token = ctx.tokenVerify
    const ret = await new SeatModel().listAll(inparam)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 单个
router.post('/seatOne', async function (ctx, next) {
    let inparam = ctx.request.body
    // 业务操作
    const ret = await new SeatModel().getOne(inparam)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 状态变更
router.post('/seatChangeStatus', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new SeatCheck().checkStatus(inparam)
    // 业务操作
    const ret = await new SeatModel().changeStatus(inparam)
    // 操作日志记录
    inparam.operateAction = '展位状态变更'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, ret)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 更新
router.post('/seatUpdate', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new SeatCheck().checkUpdate(inparam)
    // 业务操作
    inparam.operatorName = token.username
    inparam.operatorRole = token.role
    inparam.token = token
    const ret = await new SeatModel().update(inparam)
    // 操作日志记录
    inparam.operateAction = '展位更新'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, ret)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 删除
router.post('/seatDelete', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    //检查参数是否合法
    new SeatCheck().checkDelete(inparam)
    // 业务操作
    const ret = await new SeatModel().delete(inparam)
    // 操作日志记录
    inparam.operateAction = '展位删除'
    inparam.operateToken = token
    new LogModel().addOperate(inparam, null, ret)
    // 结果返回
    ctx.body = { code: 0, payload: ret }
})

// 展位互换
router.post('/seatTigger', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new SeatCheck().checkeOrder(inparam)
    // 业务操作
    await new SeatModel().seatTigger(inparam)
    // 结果返回
    ctx.body = { code: 0, payload: [] }
})

// 展位类别
router.get('/seatType', async function (ctx, next) {
    let seatTypeArr = []
    for (let code in SeatTypeEnum) {
        seatTypeArr.push({ 'code': code, 'name': SeatTypeEnum[code] })
    }
    // 结果返回
    ctx.body = { code: 0, payload: seatTypeArr }
})

module.exports = router