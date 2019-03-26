// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const _ = require('lodash')
const axios = require('axios')
// 日志相关
const moment = require('moment')
const log = require('tracer').colorConsole({ level: config.log.level })
// 持久层相关
const PlayerModel = require('./model/PlayerModel')
const PlayerBillDetailModel = require('./model/PlayerBillDetailModel')
const NASign = require('./lib/NASign')
const CQ9ResStatus = {
    code: "0",
    message: "Success",
    datetime: new Date()
}
/**
 * CQ9确认玩家是否存在
 * @param {*} account 玩家帐号
 */
router.get('/cq9/player/check/:account', async function (ctx, next) {
    // 检查WTOKEN是否合法
    if (ctx.request.header.wtoken != config.cq9.wtoken) {
        log.error(`非法WTOKEN:${ctx.request.header.wtoken}`)
        return
    }
    const userName = ctx.params.account
    // log.info(`CQ9【参数】${userName}`)
    // 查询玩家是否存在
    const player = await new PlayerModel().getPlayer(userName)
    if (!player || _.isEmpty(player)) {
        ctx.body = { data: false, status: CQ9ResStatus }
        log.error(`玩家【${userName}】不存在`)
        return
    }
    ctx.body = ctx.body = { data: true, status: CQ9ResStatus }
})

/**
 * 获取CQ9玩家余额
 * @param {*} account 玩家帐号
 */
router.get('/cq9/transaction/balance/:account', async function (ctx, next) {
    // 检查WTOKEN是否合法
    if (ctx.request.header.wtoken != config.cq9.wtoken) {
        log.error(`非法WTOKEN:${ctx.request.header.wtoken}`)
        return
    }
    const userName = ctx.params.account
    // log.info(`CQ9【参数】${userName}`)
    // 查询玩家是否存在
    const player = await new PlayerModel().getPlayer(userName)
    if (!player || _.isEmpty(player)) {
        ctx.body = { data: false, status: CQ9ResStatus }
        log.error(`玩家【${userName}】不存在`)
        return
    }
    ctx.body = { data: { balance: player.balance, currency: 'CNY' }, status: CQ9ResStatus }
})

/**
 * CQ9執行遊戲動作
 * @param {*} action 游戏动作
 * @param {*} account 使用者帐号
 * @param {*} eventTime 事件时间
 * @param {*} gamehall 游戏厂商代号
 * @param {*} gamecode 游戏代号
 * @param {*} roundid 游戏局号
 * @param {*} amount 金额
 * @param {*} mtcode 混合码
 */
router.post('/cq9/game/:action', async function (ctx, next) {
    // 检查WTOKEN是否合法
    if (ctx.request.header.wtoken != config.cq9.wtoken) {
        log.error(`非法WTOKEN:${ctx.request.header.wtoken}`)
        return
    }
    const action = ctx.params.action
    const inparam = ctx.request.body
    // log.info(`CQ9【参数】${action}`)
    // log.info(`CQ9【参数】${JSON.stringify(inparam)}`)
    // 1、查询玩家是否存在
    const player = await new PlayerModel().getPlayer(userName)
    if (!player || _.isEmpty(player)) {
        ctx.body = { data: false, status: CQ9ResStatus }
        log.error(`玩家【${userName}】不存在`)
        return
    }
    // 2、计算玩家实时余额和更新
    inparam.gameType = config.cq9.gameType    // TODO:从配置文件获取游戏类型，未来考虑自动获取
    inparam.amt = Math.abs(parseFloat(inparam.amount))
    switch (action) {
        case 'bet':
            inparam.amt *= -1
            break
        case 'debit':
            inparam.amt *= -1
            break
        case 'credit':
            inparam.amt *= 1
            break
        case 'rollin':
            ctx.body = { data: false, status: CQ9ResStatus }
            return
            break
        case 'rollout':
            ctx.body = { data: false, status: CQ9ResStatus }
            return
            break
        default:
            return
            break
    }
    const amtAfter = await new PlayerModel().updatebalance(player, inparam)
    ctx.body = ctx.body = { data: { balance: amtAfter, currency: 'CNY' }, status: CQ9ResStatus }
})

/**
 * CQ9结束回合
 * @param {*} account 玩家帐号
 * @param {*} gamehall 游戏厂商代号
 * @param {*} gamecode 游戏代号
 * @param {*} roundid 游戏局号
 * @param {*} data 返奖数据
 */
router.post('/cq9/transaction/game/endround', async function (ctx, next) {
    // 检查WTOKEN是否合法
    if (ctx.request.header.wtoken != config.cq9.wtoken) {
        log.error(`非法WTOKEN:${ctx.request.header.wtoken}`)
        return
    }
    const inparam = ctx.request.body
    // log.info(`CQ9【参数】${JSON.stringify(inparam)}`)
    // 1、查询玩家是否存在
    const player = await new PlayerModel().getPlayer(inparam.account)
    if (!player || _.isEmpty(player)) {
        ctx.body = { data: false, status: CQ9ResStatus }
        log.error(`玩家【${userName}】不存在`)
        return
    }
    // 2、计算玩家实时余额和更新
    let amtAfter = player.balance
    for (let item of inparam.data) {
        item.gameType = config.cq9.gameType    // TODO:从配置文件获取游戏类型，未来考虑自动获取
        item.amt = Mast.abs(parseFloat(item.amount))
        amtAfter = await new PlayerModel().updatebalance(player, item)
    }
    ctx.body = { data: { balance: amtAfter, currency: 'CNY' }, status: CQ9ResStatus }
})

/**
 * CQ9押注退还
 * @param {*} mtcode 混合码
 */
router.post('/cq9/transaction/game/refund', async function (ctx, next) {
    // 检查WTOKEN是否合法
    if (ctx.request.header.wtoken != config.cq9.wtoken) {
        log.error(`非法WTOKEN:${ctx.request.header.wtoken}`)
        return
    }
    const inparam = ctx.request.body
    // log.info(`CQ9【参数】${JSON.stringify(inparam)}`)
    // 1、查询玩家是否存在
    const player = await new PlayerModel().getPlayer(inparam.account)
    if (!player || _.isEmpty(player)) {
        ctx.body = { data: false, status: CQ9ResStatus }
        log.error(`玩家【${userName}】不存在`)
        return
    }
    // 2、根据mtcode查询流水退回
    // const bill = await new PlayerBillDetailModel().query({
    //     ProjectionExpression: 'amount',
    //     IndexName: 'MtcodeIndex',
    //     KeyConditionExpression: 'mtcode = :mtcode',
    //     ExpressionAttributeValues: {
    //         ':mtcode': inparam.mtcode
    //     }
    // })
    // 2、计算玩家实时余额和更新
    let amtAfter = player.balance
    // inparam.gameType = config.cq9.gameType    // TODO:从配置文件获取游戏类型，未来考虑自动获取
    // inparam.amt = Math.abs(parseFloat(bill.amount))
    // inparam.billType = 5
    // amtAfter = await new PlayerModel().updatebalance(player, inparam)

    ctx.body = { data: { balance: amtAfter, currency: 'CNY' }, status: CQ9ResStatus }
})

/**
 * CQ9查询交易记录
 * @param {*} mtcode 混合码
 */
router.get('/cq9/transaction/record/:mtcode', async function (ctx, next) {
    // 检查WTOKEN是否合法
    if (ctx.request.header.wtoken != config.cq9.wtoken) {
        log.error(`非法WTOKEN:${ctx.request.header.wtoken}`)
        return
    }
    // log.info(`CQ9【参数】${ctx.params.mtcode}`)
    ctx.body = { data: {}, status: CQ9ResStatus }
})

/**
 * CQ9把玩家所有的钱领出
 * @param {*} account 使用者帐号
 * @param {*} eventTime 事件时间
 * @param {*} mtcode 混合码
 */
router.post('/cq9/transaction/game/takeall', async function (ctx, next) {
    // 检查WTOKEN是否合法
    if (ctx.request.header.wtoken != config.cq9.wtoken) {
        log.error(`非法WTOKEN:${ctx.request.header.wtoken}`)
        return
    }
    const inparam = ctx.request.body
    // log.info(`CQ9【参数】${JSON.stringify(inparam)}`)
    // 1、查询玩家是否存在
    const player = await new PlayerModel().getPlayer(inparam.account)
    if (!player || _.isEmpty(player)) {
        ctx.body = { data: false, status: CQ9ResStatus }
        log.error(`玩家【${userName}】不存在`)
        return
    }
    ctx.body = { data: { amount: player.balance, balance: 0, currency: 'CNY' }, status: CQ9ResStatus }
})

/**
 * 玩家掉线强制登出
 * @param {*} userNameArr 玩家帐号数组
 */
// router.post('/cq9/force', async function (ctx, next) {
//     const userNameArr = ctx.request.body.userNameArr || []
//     for (let userName of userNameArr) {
//         // 查询玩家
//         const player = await new PlayerModel().getPlayer(userName)
//         if (!player || _.isEmpty(player)) {
//             ctx.body = { code: -1, msg: `玩家${userName}不存在` }
//             log.error(`玩家【${userName}】不存在`)
//         }
//         else if (player.gameId == config.cq9.gameType) {
//             log.info(`准备退出玩家【${userName}】`)
//             // 绑定签名
//             const data = {
//                 gameId: player.sid,
//                 userId: player.userId,
//                 timestamp: Date.now(),
//                 exit: 1,
//                 records: [],
//                 zlib: 1
//             }
//             NASign.bindSign(config.cq9.gameKey, ['gameId', 'timestamp', 'records'], data)
//             // 登出NA平台
//             log.info(`请求NA平台【POST】${config.na.settlementurl}`)
//             log.info('请求NA平台【参数】' + JSON.stringify(data))
//             const res = await axios.post(config.na.settlementurl, data)
//             if (res.data.code != 0) {
//                 res.data.errUserName = userName
//                 log.error(res.data)
//                 ctx.body = res.data
//             }
//         }
//     }
//     ctx.body = { code: 0, msg: '玩家批量退出成功' }
// })

module.exports = router