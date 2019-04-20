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
const GameTypeEnum = {
    '10000': { type: 4, code: '10000', name: 'NA棋牌游戏', company: 'NA' },
    '30000': { type: 1, code: '30000', name: 'NA真人视讯', company: 'NA' },
    '40000': { type: 2, code: '40000', name: 'NA电子游戏', company: 'NA' },
    '50000': { type: 3, code: '50000', name: 'NA街机游戏', company: 'NA' },
    '60000': { type: 6, code: '60000', name: 'NA捕鱼游戏', company: 'NA' },
    '70000': { type: 2, code: '70000', name: 'H5电子游戏', company: 'NA' },
    '80000': { type: 1, code: '80000', name: 'H5真人视讯', company: 'NA' },
    '90000': { type: 1, code: '90000', name: 'H5电子游戏-无神秘奖', company: 'NA' },
    '1010000': { type: 2, code: '1010000', name: 'TTG电子游戏', company: 'TTG' },
    '1020000': { type: 2, code: '1020000', name: 'PNG电子游戏', company: 'PNG' },
    '10300000': { type: 2, code: '10300000', name: 'MG电子游戏', company: 'MG' },
    '1040000': { type: 2, code: '1040000', name: 'HABA电子游戏', company: 'HABA' },
    '1050000': { type: 1, code: '1050000', name: 'AG真人游戏', company: 'AG' },
    '1060000': { type: 1, code: '1060000', name: 'SA真人游戏', company: 'SA' },
    '1070000': { type: 4, code: '1070000', name: 'KY棋牌游戏', company: 'KY' },
    '1080000': { type: 2, code: '1080000', name: 'SB电子游戏', company: 'SB' },
    '1090000': { type: 2, code: '1090000', name: 'PG电子游戏', company: 'PG' },
    // '1100000': { type: 5, code: '1100000', name: 'UG体育游戏', company: 'UG' },
    '1110000': { type: 6, code: '1110000', name: 'SA捕鱼游戏', company: 'SA' },
    '1120000': { type: 1, code: '1120000', name: 'SB真人游戏', company: 'SB' },
    '1130000': { type: 5, code: '1130000', name: 'YSB体育游戏', company: 'YSB' },
    '1140000': { type: 2, code: '1140000', name: 'RTG电子游戏', company: 'RTG' },
    '1150000': { type: 2, code: '1150000', name: 'DT电子游戏', company: 'DT' },
    '1160000': { type: 2, code: '1160000', name: 'PP电子游戏', company: 'PP' },
}

/**
 *  游戏分布饼图统计
 */
router.get('/pie/game', async (ctx, next) => {
    console.time('饼状图统计耗时')
    let inparam = ctx.request.query
    let promiseArr = []
    let pieMap = {
        playerCount: [],
        betCount: [],
        betAmount: [],
        retAmount: [],
        refundAmount: [],
        winloseAmount: []
    }
    // 获取区域玩家总人数
    promiseArr.push(queryGetPie('bill.playerCountPie', 'playerCount', inparam, pieMap))
    // 获取区域玩家总下注次数
    promiseArr.push(queryGetPie('bill.handleAmountPie', 'betCount', inparam, pieMap, 3))
    // 获取区域玩家总下注金额
    promiseArr.push(queryGetPie('bill.handleAmountPie', 'betAmount', inparam, pieMap, 3))
    // 获取区域玩家总返奖
    promiseArr.push(queryGetPie('bill.handleAmountPie', 'retAmount', inparam, pieMap, 4))
    // 获取区域玩家总退款
    promiseArr.push(queryGetPie('bill.handleAmountPie', 'refundAmount', inparam, pieMap, 5))
    // 获取区域玩家总输赢
    // promiseArr.push(queryGetPie('bill.winloseAmountPie', 'winloseAmount', inparam, pieMap))
    // 并发执行
    await Promise.all(promiseArr)
    ctx.body = { code: 0, data: pieMap }
    console.timeEnd('饼状图统计耗时')
})

// 饼状图sql查询
async function queryGetPie(sqlName, key, inparam, map, type) {
    let res = await nodebatis.query(sqlName, { method: key, type, ...inparam })
    for (let item of res) {
        map[key].push({ name: GameTypeEnum[item.gameType].name || '其他', value: key == 'betAmount' ? Math.abs(item.num) : item.num })
    }
}


module.exports = router