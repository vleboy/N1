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
let lineDay = {
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

/**
 *  当天这些图统计
 */
router.get('/line/everyDay', async (ctx, next) => {
    console.time('实时统计耗时')
    let inparam = ctx.request.query
    inparam.startTime = new Date(new Date().toLocaleDateString()).getTime()  //获取当天零点时间
    inparam.endTime = Date.now() - 5 * 60 * 60 * 1000  //获取查询的时间
    let promiseArr = []

    // 获取区域玩家总人数
    promiseArr.push(queryGetSql('bill.playerCountDay', inparam, 'playerCount'))
    // 获取区域玩家总下注次数
    promiseArr.push(queryGetSql('bill.betCountDay', inparam, 'betCount'))
    // 获取区域玩家总下注金额
    promiseArr.push(queryGetSql('bill.betAmountDay', inparam, 'betAmount'))
    // 获取区域玩家总返奖
    promiseArr.push(queryGetSql('bill.retAmountDay', inparam, 'retAmount'))
    // 获取区域玩家总退款
    promiseArr.push(queryGetSql('bill.refundAmountDay', inparam, 'refundAmount'))
    // 获取区域玩家总输赢
    promiseArr.push(queryGetSql('bill.winloseAmountDay', inparam, 'winloseAmount'))
    // 并发执行
    await Promise.all(promiseArr)
    ctx.body = { code: 0, data: lineDay }
    console.timeEnd('实时统计耗时')
})

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


// sql查询
async function queryGetSql(sqlName, inparam, key, map) {
    let res = await nodebatis.query(sqlName, { startTime: inparam.startTime, endTime: inparam.endTime, gameType: inparam.gameType })
    if (res[0].total) {
        map[key].push(res[0].total)
    } else {
        map[key].push(0)
    }
}

module.exports = router