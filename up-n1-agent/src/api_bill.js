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


// 转账
router.post('/billTransfer', async function (ctx, next) {
    let transferInfo = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new BillCheck().checkBill(transferInfo)
    // 获取转账账户
    const fromUserId = transferInfo.fromUserId || token.userId
    const fromUser = await new UserModel().queryUserById(fromUserId)
    // 操作权限
    if (Model.isAgent(fromUser) && !Model.isAgentAdmin(token) && !Model.isSubChild(token, fromUser) && fromUser.userId != token.userId) {
        throw BizErr.TokenErr('代理用户只有代理管理员/上级/自己能操作')
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
    let params = ctx.params
    let token = ctx.tokenVerify
    // 查询用户
    let userRet = await new UserModel().queryOnce({
        ProjectionExpression: '#role,points,levelIndex,userId,rate,vedioMix,liveMix,sn,username',
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeNames: {
            '#role': 'role'
        },
        ExpressionAttributeValues: {
            ':userId': params.userId
        }
    })
    let user = userRet.Items[0]
    // 操作权限
    if (Model.isAgent(user) && !Model.isAgentAdmin(token) && !Model.isSubChild(token, user) && user.userId != token.userId) {
        throw BizErr.TokenErr('代理用户只有代理管理员/上级/自己能查看')
    }
    // 查询余额
    const balance = await new BillModel().checkUserBalance(user)
    // 查询出账
    const out = await new BillModel().checkUserOutIn(user, -1)
    // 返回结果
    ctx.body = { code: 0, payload: { balance, out: out, rate: user.rate, vedioMix: user.vedioMix, liveMix: user.liveMix, userId: params.userId, sn: user.sn, username: user.username } }
})

// 账单列表
router.get('/waterfall/:userId', async function (ctx, next) {
    let userId = ctx.params.userId
    let params = ctx.request.query
    userId.length != 36 ? userId = ctx.userId : null
    let userRet = await new UserModel().queryOnce({
        ProjectionExpression: 'userId,#role,points,levelIndex',
        IndexName: 'UserIdIndex',
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: { ':userId': userId }
    })
    let user = userRet.Items[0]
    // 操作权限
    let token = ctx.tokenVerify
    if (Model.isAgent(user) && !Model.isAgentAdmin(token) && !Model.isSubChild(token, user) && user.userId != token.userId) {
        throw BizErr.TokenErr('代理用户只有代理管理员/上级/自己能查看')
    }
    // 业务查询
    let balance = +params.balance
    if (params.sn) {
        params.startKey = {
            sn: params.sn,
            userId,
            createdAt: +params.createdAt
        }
    } else {
        balance = await new BillModel().checkUserBalance(user)
    }
    params.pageSize = params.pageSize || 100
    const [bills, startKey] = await new BillModel().computeWaterfall(balance, userId, params)
    ctx.body = { code: 0, payload: bills, startKey }
})

// 日志列表
router.post('/logList', async function (ctx, next) {
    let inparam = ctx.request.body
    let token = ctx.tokenVerify
    // 检查参数是否合法
    new LogCheck().checkPage(inparam)
    // 代理管理员
    if (Model.isAgentAdmin(token)) {
        inparam.parent = null
    }
    // 代理
    else if (Model.isAgent(token)) {
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