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
    console.time(`柱状图${ctx.params.queryType}统计耗时`)
    let inparam = ctx.request.query
    let formatType = ctx.params.queryType
    let token = ctx.tokenVerify
    // 权限商户只能看自己的
    if (token.role == '100') {
        inparam.parent = token.userId
    }
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
    promiseArr.push(queryGetGraph('round.playerCountGraph', ['playerCount'], inparam, GraphMap))
    // 获取区间玩家总下注次数、下注金额、总返奖、总退款、总
    promiseArr.push(queryGetGraph('round.handleAmountGraph', ['betCount', 'betAmount', 'retAmount', 'refundAmount', 'winloseAmount'], inparam, GraphMap))
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
                        item.x = '周日'
                        break;
                    case 1:
                        item.x = '周一'
                        break;
                    case 2:
                        item.x = '周二'
                        break;
                    case 3:
                        item.x = '周三'
                        break;
                    case 4:
                        item.x = '周四'
                        break;
                    case 5:
                        item.x = '周五'
                        break;
                    case 6:
                        item.x = '周六'
                        break;
                }
                return item
            })
        }
    }

    ctx.body = { code: 0, data: GraphMap }
    console.timeEnd(`柱状图${ctx.params.queryType}统计耗时`)
})

// 柱状图sql查询
async function queryGetGraph(sqlName, keyArr, inparam, map) {
    let res = await nodebatis.query(sqlName, { ...inparam })
    for (let key of keyArr) {
        for (let item of res) {
            for (let valueMap of map[key]) {
                if (valueMap.x == item.hours) {
                    valueMap.y = key == 'betAmount' ? Math.abs(item[key]) : item[key]
                }
            }
        }
    }
}

module.exports = router