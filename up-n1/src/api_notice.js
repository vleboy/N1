// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const uuid = require('uuid/v4')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const LogModel = require('./model/LogModel')
const NoticeModel = require('./model/NoticeModel')
const AdCheck = require('./biz/AdCheck')

// 创建跑马灯
router.post('/notice/add', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    const tokenInfo = ctx.tokenVerify
    // 检查参数是否合法
    new AdCheck().checkAddNotic(inparam)
    //业务操作
    let putNotice = {
        noid: uuid(),
        ...inparam,
        userId: tokenInfo.userId,
        operatorName: tokenInfo.username,
        operatorRole: tokenInfo.role,
        operatorId: tokenInfo.userId,
        operatorDisplayName: tokenInfo.displayName,
        operatorDisplayId: tokenInfo.displayId || 'NULL!',
        operatorSn: tokenInfo.sn || 'NULL!'
    }
    if (tokenInfo.role == '1') {
        putNotice.operatorMsn = '-1'  //如果是管理员发送给所有商户
    } else {
        putNotice.operatorMsn = tokenInfo.msn  //商户发给自己
    }
    const ret = await new NoticeModel().putItem(putNotice)
    // 操作日志记录
    inparam.operateAction = '创建跑马灯'
    inparam.operateToken = tokenInfo
    new LogModel().addOperate(inparam, null, ret)
    // 返回结果
    ctx.body = { code: 0, data: putNotice, msg: "success" }
})

// 修改跑马灯
router.post('/notice/update', async function (ctx, next) {
    let inparam = ctx.request.body
    const tokenInfo = ctx.tokenVerify
    // 业务操作
    let noticeInfo = await new NoticeModel().getNotice(inparam.noid)
    if (_.isEmpty(noticeInfo)) {
        throw { code: -1, msg: '跑马灯不存在' }
    }
    let updateNotic = {
        ...noticeInfo,
        ...inparam
    }
    const ret = await new NoticeModel().putItem(updateNotic)
    // 操作日志记录
    inparam.operateAction = '更新跑马灯'
    inparam.operateToken = tokenInfo
    new LogModel().addOperate(inparam, null, ret)
    // 结果返回
    ctx.body = { code: 0, data: updateNotic, msg: "success" }
})

// 跑马灯列表
router.post('/notice/list', async function (ctx, next) {
    let inparam = ctx.request.body
    let tokenInfo = ctx.tokenVerify
    // 业务操作
    let scan = {
        FilterExpression: 'operatorName = :operatorName',
        ExpressionAttributeValues: {
            ':operatorName': tokenInfo.username
        }
    }
    // 条件搜索
    if (!_.isEmpty(inparam.query)) {
        if (inparam.query.content) {
            inparam.query.content = { $like: inparam.query.content }
        }
    }
    // 查询
    let list = await new NoticeModel().bindFilterScan(scan, inparam.query, false)
    // 结果返回
    ctx.body = { code: 0, list: list, msg: "success" }
})

//商户运营记录中的跑马灯列表
router.post('/notice/operate/list', async function (ctx, next) {
    let inparam = ctx.request.body
    // 业务操作
    let scan = {
        FilterExpression: 'operatorRole = :operatorRole',
        ExpressionAttributeValues: {
            ':operatorRole': '100'
        }
    }
    // 条件搜索
    if (!_.isEmpty(inparam.query)) {
        if (inparam.query.operatorDisplayId) { inparam.query.operatorDisplayId = +inparam.query.operatorDisplayId }
        if (inparam.query.operatorSn) { inparam.query.operatorSn = inparam.query.operatorSn }
    }
    // 查询
    let list = await new NoticeModel().bindFilterScan(scan, inparam.query, false)
    // 结果返回
    ctx.body = { code: 0, list: list, msg: "success" }
})

// 删除跑马灯
router.post('/notice/remove', async function (ctx, next) {
    let inparam = ctx.request.body
    const tokenInfo = ctx.tokenVerify
    // 业务操作
    let noticeInfo = await new NoticeModel().getNotice(inparam.noid)
    if (_.isEmpty(noticeInfo)) {
        throw { code: -1, msg: '跑马灯不存在' }
    }
    const ret = await new NoticeModel().delNotice(inparam.noid)
    // 操作日志记录
    inparam.operateAction = '删除跑马灯'
    inparam.operateToken = tokenInfo
    new LogModel().addOperate(inparam, null, ret)
    // 结果返回
    ctx.body = { code: 0, msg: 'success' }
})



module.exports = router