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
const UserModel = require('./model/UserModel')
const BillModel = require('./model/BillModel')

const BillCheck = require('./biz/BillCheck')
const LogCheck = require('./biz/LogCheck')
const BizErr = require('./lib/Codes').BizErr
const Model = require('./lib/Model').Model

// 为包站系统定制使用帐号查询
router.post('/billTransfer', async function (ctx, next) {
    let transferInfo = ctx.request.body
    if (transferInfo.fromUser) {
        let fromUserRet = await new UserModel().getUserByName(transferInfo.fromRole, transferInfo.fromUser)
        transferInfo.fromUserId = fromUserRet.userId
    }
    return next()
})

// 转账
router.post('/billTransfer', async function (ctx, next) {
    let transferInfo = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new BillCheck().checkBill(transferInfo)
    // 获取转账账户
    let fromUserId = transferInfo.fromUserId || token.userId
    const fromUser = await new UserModel().queryUserById(fromUserId)
    // 操作权限
    if (!Model.isPlatformAdmin(token) && !Model.isSubChild(token, fromUser) && fromUser.userId != token.userId) {
        throw BizErr.TokenErr('平台用户只有平台管理员/上级/自己能操作')
    }
    // 获取目的账户
    const toUser = await new UserModel().getUserByName(transferInfo.toRole, transferInfo.toUser)
    // 设置操作人TOKEN
    fromUser.operatorToken = token
    // 获取fromUser的当前余额
    const userBalance = await new BillModel().checkUserBalance(fromUser)
    if (transferInfo.amount > userBalance) {
        throw BizErr.BalanceErr()
    }
    // 开始转账业务
    const depositBillRet = await new BillModel().billTransfer(fromUser, {
        ...transferInfo,
        toLevel: toUser.level,
        toDisplayName: toUser.displayName,
        toUserId: toUser.userId,
        amount: transferInfo.amount
    })
    // 返回结果
    ctx.body = { code: 0, payload: depositBillRet }
})

// 用户余额
router.get('/bills/:userId', async function (ctx, next) {
    let inparam = ctx.params
    let token = ctx.tokenVerify
    let userRet = await new UserModel().queryOnce({
        ProjectionExpression: '#role,points,levelIndex',
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeNames: {
            '#role': 'role'
        },
        ExpressionAttributeValues: {
            ':userId': inparam.userId
        }
    })
    let user = userRet.Items[0]
    user.userId = inparam.userId
    // 操作权限
    if (!Model.isPlatformAdmin(token) && !Model.isSubChild(token, user) && user.userId != token.userId) {
        throw BizErr.TokenErr('平台用户只有平台管理员/上级/自己能查看')
    }
    // 查询余额
    const p1 = new BillModel().checkUserBalance(user)
    // 查询出账
    const p2 = new BillModel().checkUserOutIn(user, -1)
    const [balance, out] = await Promise.all([p1, p2])
    // 返回结果
    ctx.body = { code: 0, payload: { balance: +balance.toFixed(2), out: +out.toFixed(2), ...user } }
})

// 为包站系统定制使用帐号查询
router.get('/waterfall/:userAccount', async function (ctx, next) {
    let inparam = ctx.params
    if (inparam.userAccount && inparam.userAccount.length != 36) {
        let res = await new UserModel().getUserByName('100', inparam.userAccount)
        ctx.userId = res.userId
    }
    return next()
})
// 账单列表
router.get('/waterfall/:userId', async function (ctx, next) {
    let inparam = ctx.params
    inparam.userId.length != 36 ? inparam.userId = ctx.userId : null
    let token = ctx.tokenVerify
    let userRet = await new UserModel().queryOnce({
        ProjectionExpression: '#role,points,levelIndex',
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeNames: {
            '#role': 'role'
        },
        ExpressionAttributeValues: {
            ':userId': inparam.userId
        }
    })
    let user = userRet.Items[0]
    user.userId = inparam.userId
    // 操作权限
    if (!Model.isPlatformAdmin(token) && !Model.isSubChild(token, user) && user.userId != token.userId) {
        throw BizErr.TokenErr('平台用户只有平台管理员/上级/自己能查看')
    }
    // 业务查询
    const bills = await new BillModel().computeWaterfall(user.points, inparam.userId)
    // 返回结果
    ctx.body = { code: 0, payload: bills }
})

// 日志列表
router.post('/logList', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new LogCheck().checkPage(inparam)
    // 平台管理员
    if (Model.isPlatformAdmin(token)) {
        inparam.parent = null
    }
    // 线路商 
    else if (Model.isManager(token)) {
        inparam.parent = token.userId
    }
    // 商户
    else if (Model.isMerchant(token)) {
        inparam.parent = token.userId
    }
    else {
        throw BizErr.TokenErr('身份权限错误')
    }
    // 业务操作
    const ret = await new LogModel().logPage(inparam)
    // 返回结果
    ctx.body = { code: 0, payload: ret }
})


module.exports = router