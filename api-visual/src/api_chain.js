// 系统配置参数
const config = require('config')
// 路由相关
const Router = require('koa-router')
const router = new Router()
// 工具相关
const nodebatis = global.nodebatis
const _ = require('lodash')
const dayjs = require('dayjs')
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
    '90000': { type: 2, code: '90000', name: 'H5电子游戏-无神秘奖', company: 'NA' },
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
 *  今天对比昨天的数据
 */
router.get('/chain/:queryType', async (ctx, next) => {
    console.time('环比统计耗时')
    let inparam = ctx.request.query
    let queryType = ctx.params.queryType
    // 权限商户只能看自己的
    let token = ctx.tokenVerify 
    if (token.role == '100') {
        inparam.parent = token.userId
    }
    let chainMap = {
        playerCount: [],
        betCount: [],
        betAmount: [],
        retAmount: [],
        refundAmount: [],
        winloseAmount: []
    }
    let startTime0 = 0, endTime0 = 0, startTime1 = 0, endTime1 = 0
    switch (queryType) {
        case 'days':
            //获取今天的开始和结束时间戳
            startTime0 = new Date(new Date().setHours(0, 0, 0, 0)).getTime()
            endTime0 = Date.now()
            //获取昨天的开始和结束时间戳
            startTime1 = startTime0 - 24 * 60 * 60 * 1000
            endTime1 = startTime0 - 1
            break;
        case 'weeks':
            //获取这周的开始和结束时间戳
            startTime0 = dayjs().startOf('week').valueOf() + 24 * 60 * 60 * 1000
            endTime0 = dayjs().endOf('second').valueOf()
            //获取上周的开始和结束时间戳
            startTime1 = dayjs().add(-1, 'week').startOf('week').valueOf() + 24 * 60 * 60 * 1000
            endTime1 = startTime0 - 1
            break;
        case 'months':
            //获取本月的开始和结束时间戳
            startTime0 = dayjs().startOf('month').valueOf()
            endTime0 = dayjs().endOf('second').valueOf()
            //获取上月的开始和结束时间戳
            startTime1 = dayjs().add(-1, 'month').startOf('month').valueOf()
            endTime1 = startTime0 - 1
            break;
    }
    //第一阶段得查询
    let promiseArr = []
    inparam.i = 0
    inparam.startTime = startTime0
    inparam.endTime = endTime0
    // 获取区域玩家总人数
    promiseArr.push(queryGetChain('bill.playerCountPie', 'playerCount', inparam, chainMap))
    // 获取区域玩家总下注次数
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'betCount', inparam, chainMap, 3))
    // 获取区域玩家总下注金额
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'betAmount', inparam, chainMap, 3))
    // 获取区域玩家总返奖
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'retAmount', inparam, chainMap, 4))
    // 获取区域玩家总退款
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'refundAmount', inparam, chainMap, 5))
    // 获取区域玩家总输赢
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'winloseAmount', inparam, chainMap))
    // 并发执行
    await Promise.all(promiseArr)
    //第二阶段得查询
    promiseArr = []
    inparam.i = 1
    inparam.startTime = startTime1
    inparam.endTime = endTime1
    // 获取区域玩家总人数
    promiseArr.push(queryGetChain('bill.playerCountPie', 'playerCount', inparam, chainMap))
    // 获取区域玩家总下注次数
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'betCount', inparam, chainMap, 3))
    // 获取区域玩家总下注金额
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'betAmount', inparam, chainMap, 3))
    // 获取区域玩家总返奖
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'retAmount', inparam, chainMap, 4))
    // 获取区域玩家总退款
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'refundAmount', inparam, chainMap, 5))
    // 获取区域玩家总输赢
    promiseArr.push(queryGetChain('bill.handleAmountPie', 'winloseAmount', inparam, chainMap))
    // 并发执行
    await Promise.all(promiseArr)
    //数据结构处理
    for (let key in chainMap) {
        chainMap[key] = _.groupBy(chainMap[key], 'name')
    }
    ctx.body = { code: 0, data: chainMap }
    console.timeEnd('环比统计耗时')
})

// 对比图sql查询
async function queryGetChain(sqlName, key, inparam, map, type) {
    let res = await nodebatis.query(sqlName, { method: key, type, ...inparam })
    for (let item of res) {
        map[key].push({ name: GameTypeEnum[item.gameType].name || '其他', value: key == 'betAmount' ? Math.abs(item.num) : item.num, i: inparam.i })
    }
}


module.exports = router