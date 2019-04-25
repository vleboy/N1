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

//时间段统计柱状图(时、周、月)
router.get('/graph/:queryType', async (ctx, next) => {
    console.time('柱状图统计耗时')
    let inparam = ctx.request.query
    let formatType = ctx.params.queryType
    let promiseArr = []
    // 时间柱状图map
    let GraphMap = {
        playerCount: [],
        betCount: [],
        betAmount: [],
        retAmount: [],
        refundAmount: [],
        winloseAmount: []
    }
    switch (formatType) {
        case 'hours':
            inparam.formatType = '%k'
            inparam.start = 0
            inparam.end = 24
            break;
        case 'weeks':
            inparam.formatType = '%w'
            inparam.start = 0
            inparam.end = 7
            break;
        case 'months':
            inparam.formatType = '%c'
            inparam.start = 1
            inparam.end = 13
            break;
    }

    for (let i = inparam.start; i < inparam.end; i++) {
        GraphMap.playerCount.push({ x: i, y: 0 })
        GraphMap.betCount.push({ x: i, y: 0 })
        GraphMap.betAmount.push({ x: i, y: 0 })
        GraphMap.retAmount.push({ x: i, y: 0 })
        GraphMap.refundAmount.push({ x: i, y: 0 })
        GraphMap.winloseAmount.push({ x: i, y: 0 })
    }
    // 获取区间玩家总人数
    promiseArr.push(queryGetGraph('bill.playerCountGraph', 'playerCount', inparam, GraphMap))
    // 获取区间玩家总下注次数
    promiseArr.push(queryGetGraph('bill.handleAmountGraph', 'betCount', inparam, GraphMap, 3))
    // 获取区间玩家总下注金额
    promiseArr.push(queryGetGraph('bill.handleAmountGraph', 'betAmount', inparam, GraphMap, 3))
    // 获取区间玩家总返奖
    promiseArr.push(queryGetGraph('bill.handleAmountGraph', 'retAmount', inparam, GraphMap, 4))
    // 获取区间玩家总退款
    promiseArr.push(queryGetGraph('bill.handleAmountGraph', 'refundAmount', inparam, GraphMap, 5))
    // 获取区间玩家总输赢
    promiseArr.push(queryGetGraph('bill.handleAmountGraph', 'winloseAmount', inparam, GraphMap))
    // 并发执行
    await Promise.all(promiseArr)

    //月查询过滤掉y为0的值
    if (formatType == 'months') {
        for (let key in GraphMap) {
            GraphMap[key] = GraphMap[key].filter((item) => {
                if (item.y == 0) {
                    return false
                } else {
                    return true
                }
            })
        }
    }
    //周统计将结果映射成中文
    if (formatType == 'weeks') {
        for (let key in GraphMap) {
            GraphMap[key] = GraphMap[key].map((item) => {
                switch (item.x) {
                    case 0:
                        item.x = '星期日'
                        break;
                    case 1:
                        item.x = '星期一'
                        break;
                    case 2:
                        item.x = '星期二'
                        break;
                    case 3:
                        item.x = '星期三'
                        break;
                    case 4:
                        item.x = '星期四'
                        break;
                    case 5:
                        item.x = '星期五'
                        break;
                    case 6:
                        item.x = '星期六'
                        break;
                }
                return item
            })
        }
    }

    ctx.body = { code: 0, data: GraphMap }
    console.timeEnd('柱状图统计耗时')
})



// 柱状图sql查询
async function queryGetGraph(sqlName, key, inparam, map, type) {
    let res = await nodebatis.query(sqlName, { method: key, type, ...inparam })
    for (let item of res) {
        for (let valueMap of map[key]) {
            if (valueMap.x == item.hours) {
                valueMap.y = key == 'betAmount' ? Math.abs(item.count) : item.count
            }
        }
    }
}

module.exports = router