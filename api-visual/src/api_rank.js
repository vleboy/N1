// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const nodebatis = global.nodebatis
const _ = require('lodash')
// 日志相关
const log = require('tracer').colorConsole({ level: config.log.level })

/**
 *  商户排行榜统计
 */
router.get('/rank/merchant', async (ctx, next) => {
    console.time('商户排行榜统计耗时')
    let inparam = ctx.request.query
    // 权限商户只能看自己的
    if (token.role == '100') {
        inparam.parent = token.userId
    }
    //初始map
    let rankMap = {
        playerCount: [],
        betCount: [],
        betAmount: [],
        retAmount: [],
        winloseAmount: []
    }
    let promiseArr = []
    // 获取区域玩家总人数
    promiseArr.push(queryGetRank('bill.playerCountRank', 'playerCount', inparam, rankMap))
    // 获取区域玩家总下注次数
    promiseArr.push(queryGetRank('bill.handleAmountRank', 'betCount', inparam, rankMap, 3))
    // 获取区域玩家总下注金额
    promiseArr.push(queryGetRank('bill.handleAmountRank', 'betAmount', inparam, rankMap, 3))
    // 获取区域玩家总返奖
    promiseArr.push(queryGetRank('bill.handleAmountRank', 'retAmount', inparam, rankMap, 4))
    // 获取区域玩家总输赢
    promiseArr.push(queryGetRank('bill.handleAmountRank', 'winloseAmount', inparam, rankMap))
    // 并发执行
    await Promise.all(promiseArr)
    ctx.body = { code: 0, data: rankMap }
    console.timeEnd('商户排行榜统计耗时')
})

/**
 *  玩家排行榜统计
 */
router.get('/rank/player', async (ctx, next) => {
    console.time('商户排行榜统计耗时')
    let inparam = ctx.request.query
    // 权限商户只能看自己的
    if (token.role == '100') {
        inparam.parent = token.userId
    }
    //初始map
    let rankMap = {
        betCount: [],
        betAmount: [],
        retAmount: [],
        winloseAmount: []
    }
    let promiseArr = []
    // 获取区域玩家总下注次数
    promiseArr.push(queryGetRank('bill.handleAmountPlayerRank', 'betCount', inparam, rankMap, 3))
    // 获取区域玩家总下注金额
    promiseArr.push(queryGetRank('bill.handleAmountPlayerRank', 'betAmount', inparam, rankMap, 3))
    // 获取区域玩家总返奖
    promiseArr.push(queryGetRank('bill.handleAmountPlayerRank', 'retAmount', inparam, rankMap, 4))
    // 获取区域玩家总输赢
    promiseArr.push(queryGetRank('bill.handleAmountPlayerRank', 'winloseAmount', inparam, rankMap))
    // 并发执行
    await Promise.all(promiseArr)
    ctx.body = { code: 0, data: rankMap }
    console.timeEnd('商户排行榜统计耗时')
})


// 排行榜统计sql
async function queryGetRank(sqlName, key, inparam, map, type) {
    let res = await nodebatis.query(sqlName, { method: key, type, ...inparam })
    if (key == 'winloseAmount' && res.length > 20) {
        res = res.slice(0, 10).concat(res.slice(res.length - 10))
    }
    for (let item of res) {
        map[key].push({ x: item.parentDisplayName || item.userName, y: key == 'betAmount' ? Math.abs(item.num) : item.num })
    }
}





module.exports = router