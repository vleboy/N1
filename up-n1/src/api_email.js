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
// const ToolModel = require('./model/ToolModel')
// const PackageModel = require('./model/PackageModel')
const EmailModel = require('./model/EmailModel')
const AdCheck = require('./biz/AdCheck')

// 创建邮件
router.post('/email/add', async function (ctx, next) {
    //获取入参
    let inparam = ctx.request.body
    const tokenInfo = ctx.tokenVerify
    let names = inparam.names || []  //玩家数组
    let mNames = inparam.mNames || [] //商户数组
    // 检查参数是否合法
    new AdCheck().checkAddEmail(inparam)
    //参数校验
    if (inparam.tools.length > 12) {
        throw { code: -1, msg: "请添加小于12种道具" }
    }
    // if (!_.isEmpty(inparam.tools)) {
    //     for (let item of inparam.tools) {
    //         if (!item.sum || !item.contentType) {
    //             throw { code: -1, msg: "道具参数不正确" }
    //         }
    //         let info = ''
    //         if (item.contentType == 1) {
    //             info = await new ToolModel().getToolByName(item.toolName)
    //         } else if (item.contentType == 2) {
    //             info = await new PackageModel().getPackageByName(item.packageName)
    //         }
    //         if (!info) {
    //             throw { code: -1, msg: "道具参数有误" }
    //         }
    //         Object.assign(item, info)
    //     }
    // }
    //如果是商户
    if (tokenInfo.role == '100') {
        mNames = [tokenInfo.username]
    }
    //组装写入邮件数据
    let putEmail = {
        emid: uuid(),   //邮件唯一id
        title: inparam.title,  //邮件标题
        content: inparam.content, //邮件内容
        sendTime: +inparam.sendTime, //邮件发送时间
        state: inparam.state || 0,   //邮件状态0未发送
        tools: inparam.tools,    //邮件包含的道具内容
        names,                  //玩家
        mNames,                 //商户
        createdAt: Date.now(),
        msn: inparam.msn,
        userId: inparam.userId || -1,
        nickname: inparam.nickname || 'NULL!',
        sendUserId: inparam.sendUserId || 'NULL!',
        sendUser: inparam.sendUser || 'NULL!',
        operatorName: tokenInfo.username,
        operatorRole: tokenInfo.role,
        operatorMsn: tokenInfo.msn || 'NULL!',
        operatorId: tokenInfo.userId,
        operatorDisplayName: tokenInfo.displayName,
        operatorDisplayId: tokenInfo.displayId || 'NULL!',
        operatorSn: tokenInfo.sn || 'NULL!'
    }
    console.log(putEmail)
    await new EmailModel().putItem(putEmail)
    // 返回结果
    ctx.body = { code: 0, data: putEmail }
})

// 邮件列表
router.post('/email/list', async function (ctx, next) {
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
    let list = await new EmailModel().bindFilterScan(scan, inparam.query, false)
    // 结果返回
    ctx.body = { code: 0, list: list.Items }
})

// 商户运营中心邮件列表
router.post('/email/operate/list', async function (ctx, next) {
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
    let list = await new EmailModel().bindFilterScan(scan, inparam.query, false)
    // 结果返回
    ctx.body = { code: 0, list: list.Items }
})

module.exports = router