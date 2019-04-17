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

//当天全局折线图map
let lineMap = {
    playerCount: [],
    betCount: [],
    betAmount: [],
    retAmount: [],
    refundAmount: [],
    winloseAmount: []
}

//五分钟全局对象统计输赢金额
let winloseMap = {
    winloseAmount: []
}

//累积统计5分钟输赢金额
router.get('/line/winloseAmount', async (ctx, next) => {
    console.time('实时统计耗时')
    let inparam = ctx.request.query
    inparam.inc = inparam.inc ? +inparam.inc : 1   //增量
    inparam.minute = inparam.minute ? +inparam.minute : 5 * 60   //时间区域
    if (winloseMap.winloseAmount.length == 0) { //初始
        inparam.startTime = new Date(new Date().toLocaleDateString()).getTime()  //获取当天零点时间
        inparam.endTime = Date.now()
        inparam.init = true
    } else {
        inparam.startTime = winloseMap.winloseAmount[winloseMap.winloseAmount.length - 1].x
        inparam.endTime = inparam.startTime + inparam.inc * 10000
    }
    // 获取区域玩家总输赢
    let res = await nodebatis.query('bill.winloseAmountDay', { startTime: inparam.startTime, endTime: inparam.endTime, gameType: inparam.gameType })
    let addNum = res[0].total ? res[0].total : 0
    if (inparam.init) {
        winloseMap.winloseAmount.push({ x: inparam.endTime, y: addNum })
    } else {
        if (winloseMap.winloseAmount.length == inparam.minute / inparam.inc) {
            let lastmap = winloseMap.winloseAmount[winloseMap.winloseAmount.length - 1]  //取出最后一个
            winloseMap.winloseAmount.shift()  // 删除第一个
            winloseMap.winloseAmount.push({ x: inparam.endTime, y: lastmap.y + addNum })  //加入新的
        } else {
            winloseMap['winloseAmount'].push({ x: inparam.endTime, y: addNum })
        }
    }
    ctx.body = { code: 0, data: winloseMap.winloseAmount }
    console.timeEnd('实时统计耗时')
})

//时间段柱状图
router.get('/line/graph', async (ctx, next) => {
    console.time('柱状图统计耗时')
    let inparam = ctx.request.query
    let promiseArr = []
    // 初始时间柱状图map
    let GraphMap = {
        playerCount: [],
        betCount: [],
        betAmount: [],
        retAmount: [],
        refundAmount: [],
        winloseAmount: []
    }
    for (let i = 0; i < 24; i++) {
        GraphMap.playerCount.push({ x: i, y: 0 })
        GraphMap.betCount.push({ x: i, y: 0 })
        GraphMap.betAmount.push({ x: i, y: 0 })
        GraphMap.retAmount.push({ x: i, y: 0 })
        GraphMap.refundAmount.push({ x: i, y: 0 })
        GraphMap.winloseAmount.push({ x: i, y: 0 })
    }
    // 获取区域玩家总人数
    promiseArr.push(queryGetGraph('bill.playerCountGraph', inparam, 'playerCount', GraphMap))
    // 获取区域玩家总下注次数
    promiseArr.push(queryGetGraph('bill.betCountGraph', inparam, 'betCount', GraphMap))
    // 获取区域玩家总下注金额
    promiseArr.push(queryGetGraph('bill.betAmountGraph', inparam, 'betAmount', GraphMap))
    // 获取区域玩家总返奖
    promiseArr.push(queryGetGraph('bill.retAmountGraph', inparam, 'retAmount', GraphMap))
    // 获取区域玩家总退款
    promiseArr.push(queryGetGraph('bill.refundAmountGraph', inparam, 'refundAmount', GraphMap))
    // 获取区域玩家总输赢
    promiseArr.push(queryGetGraph('bill.winloseAmountGraph', inparam, 'winloseAmount', GraphMap))
    // 并发执行
    await Promise.all(promiseArr)
    ctx.body = { code: 0, data: GraphMap }
    console.timeEnd('柱状图统计耗时')
})

/**
 *  当天折线图统计
 */
router.get('/line/day', async (ctx, next) => {
    console.time('折线图统计耗时')
    let inparam = ctx.request.query
    inparam.startTime = new Date(new Date().toLocaleDateString()).getTime()  //获取当天零点时间
    inparam.endTime = Date.now() - 5 * 60 * 60 * 1000  //获取查询的时间
    let promiseArr = []
    // 获取区域玩家总人数
    promiseArr.push(queryGetLine('bill.playerCountDay', inparam, 'playerCount'))
    // 获取区域玩家总下注次数
    promiseArr.push(queryGetLine('bill.betCountDay', inparam, 'betCount'))
    // 获取区域玩家总下注金额
    promiseArr.push(queryGetLine('bill.betAmountDay', inparam, 'betAmount'))
    // 获取区域玩家总返奖
    promiseArr.push(queryGetLine('bill.retAmountDay', inparam, 'retAmount'))
    // 获取区域玩家总退款
    promiseArr.push(queryGetLine('bill.refundAmountDay', inparam, 'refundAmount'))
    // 获取区域玩家总输赢
    promiseArr.push(queryGetLine('bill.winloseAmountDay', inparam, 'winloseAmount'))
    // 并发执行
    await Promise.all(promiseArr)
    ctx.body = { code: 0, data: lineMap }
    console.timeEnd('折线图统计耗时')
})

// 折线图sql查询
async function queryGetLine(sqlName, inparam, key) {
    let res = await nodebatis.query(sqlName, { startTime: inparam.startTime, endTime: inparam.endTime, gameType: inparam.gameType })
    if (res[0].total) {
        lineMap[key].push(res[0].total)
    } else {
        lineMap[key].push(0)
    }
}
// 柱状图sql查询
async function queryGetGraph(sqlName, inparam, key, map) {
    let res = await nodebatis.query(sqlName, { startTime: inparam.startTime, endTime: inparam.endTime, gameType: inparam.gameType })
    for (let item of res) {
        for (let valueMap of map[key]) {
            if (valueMap.x == item.days) {
                valueMap.y = item.count
            }
        }
    }
}

module.exports = router