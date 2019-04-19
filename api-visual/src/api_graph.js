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
    // 获取区间玩家总人数
    promiseArr.push(queryGetGraph('bill.playerCountGraph', inparam, 'playerCount', GraphMap))
    // 获取区间玩家总下注次数
    promiseArr.push(queryGetGraph('bill.handleAmountGraph', inparam, 'betCount', GraphMap), 3)
    // 获取区间玩家总下注金额
    promiseArr.push(queryGetGraph('bill.handleAmountGraph', inparam, 'betAmount', GraphMap, 3))
    // 获取区间玩家总返奖
    promiseArr.push(queryGetGraph('bill.handleAmountGraph', inparam, 'retAmount', GraphMap, 4))
    // 获取区间玩家总退款
    promiseArr.push(queryGetGraph('bill.handleAmountGraph', inparam, 'refundAmount', GraphMap, 5))
    // 获取区间玩家总输赢
    promiseArr.push(queryGetGraph('bill.handleAmountGraph', inparam, 'winloseAmount', GraphMap))
    // 并发执行
    await Promise.all(promiseArr)
    ctx.body = { code: 0, data: GraphMap }
    console.timeEnd('柱状图统计耗时')
})

// 柱状图sql查询
async function queryGetGraph(sqlName, inparam, key, map, type) {
    let res = await nodebatis.query(sqlName, { method: key, type, startTime: inparam.startTime, endTime: inparam.endTime, gameType: inparam.gameType })
    for (let item of res) {
        for (let valueMap of map[key]) {
            if (valueMap.x == item.hours) {
                valueMap.y = key == 'betAmount' ? Math.abs(item.count) : item.count
            }
        }
    }
}



module.exports = router