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
    let token = ctx.tokenVerify
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
    promiseArr.push(queryGetRank('round.playerCountRank', ['playerCount'], inparam, rankMap))
    // 获取区域玩家总下注次数
    promiseArr.push(queryGetRank('round.handleAmountRank', ['betCount', 'betAmount', 'retAmount', 'winloseAmount'], inparam, rankMap))
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
    let token = ctx.tokenVerify
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
    promiseArr.push(queryGetRank('round.handleAmountPlayerRank', ['betCount', 'betAmount', 'retAmount', 'winloseAmount'], inparam, rankMap))
    // 并发执行
    await Promise.all(promiseArr)
    //玩家特殊处理
    //特殊处理
    for (let key in rankMap) {
        if (key != 'winloseAmount') { //只取十条数据
            rankMap[key] = rankMap[key].slice(0, 10)
        }
    }
    ctx.body = { code: 0, data: rankMap }
    console.timeEnd('商户排行榜统计耗时')
})


// 排行榜统计sql
async function queryGetRank(sqlName, keyArr, inparam, map) {
    let res = await nodebatis.query(sqlName, { ...inparam })
    for (let key of keyArr) {
        if (key == 'winloseAmount' && res.length > 20) {
            res = res.slice(0, 10).concat(res.slice(res.length - 10))
        }
        for (let item of res) {
            map[key].push({ x: item.parentDisplayName || item.userName, y: key == 'betAmount' ? Math.abs(item[key]) : item[key] })
        }
    }
    //排序处理
    for (let key in map) {
        if (key == 'betAmount' || key == 'winloseAmount') {  //asc处理
            map[key].sort(function (a, b) { return a.y - b.y })
        } else if (key == 'betCount' || key == 'retAmount') {  //desc处理
            map[key].sort(function (a, b) { return b.y - a.y })
        }
    }
}





module.exports = router